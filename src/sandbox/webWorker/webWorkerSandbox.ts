import type { Tool } from "ollama";
import * as rpc from "vscode-jsonrpc";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
} from "vscode-jsonrpc/browser.js";
import type { ISandbox } from "../sandbox.ts";
import {
  CallTool,
  CtxComputeQueryEmbedding,
  CtxVectorSearch,
  Init,
  type IProjectJson,
  Load,
} from "./messages.ts";
import {
  extractConfigHostNames,
  loadRawConfigFromEnv,
  type Source,
  timeout,
} from "../../util.ts";
import type { IContext } from "../../context/context.ts";
import type { ProjectManifest } from "../../project/project.ts";
import type { Loader } from "../../loader.ts";
import { dirname } from "@std/path/dirname";

export type Permissions = {
  /**
   * For local projects allow reading all locations for imports to work.
   * TODO: This could be limited to the project dir + DENO_DIR cache but DENO_DIR doesn't provide the default currently
   */
  allowRead?: boolean;
  allowFFI?: boolean;
};

const IPFS_PERMISSIONS = (dir?: string): Deno.PermissionOptionsObject => ({
  read: dir ? [dirname(dir)] : false, // Allow the cache dir
  ffi: false,
});

const LOCAL_PERMISSIONS: Deno.PermissionOptionsObject = {
  read: true,
  ffi: true,
};

function getPermisionsForSource(
  source: Source,
  projectDir: string,
): Deno.PermissionOptionsObject {
  switch (source) {
    case "local":
      return LOCAL_PERMISSIONS;
    case "ipfs":
      return IPFS_PERMISSIONS(projectDir);
    default:
      throw new Error(
        `Unable to set permissions for unknown source: ${source}`,
      );
  }
}

async function workerFactory(
  manifest: ProjectManifest,
  entryPath: string,
  config: Record<string, string>,
  permissions: Deno.PermissionOptionsObject,
): Promise<[Worker, rpc.MessageConnection, IProjectJson]> {
  const w = new Worker(
    import.meta.resolve("./webWorker.ts"),
    {
      type: "module",
      deno: {
        permissions: permissions,
      },
    },
  );

  // Setup a JSON RPC for interaction to the worker
  const conn = rpc.createMessageConnection(
    new BrowserMessageReader(w),
    new BrowserMessageWriter(w),
  );

  conn.listen();

  await conn.sendRequest(Load, entryPath);

  const pJson = await conn.sendRequest(
    Init,
    manifest,
    config,
  );

  return [w, conn, pJson];
}

export class WebWorkerSandbox implements ISandbox {
  #tools: Tool[];
  #initWorker: () => ReturnType<typeof workerFactory>;

  /**
   * Create a new WebWorkerSandbox
   * @param loader The loader for loading any project resources
   * @param timeout Tool call timeout in MS
   * @returns A sandbox instance
   */
  public static async create(
    loader: Loader,
    timeout: number,
  ): Promise<WebWorkerSandbox> {
    const [manifestPath, manifest, source] = await loader.getManifest();
    const config = loadRawConfigFromEnv(manifest.config);

    const permissions = getPermisionsForSource(source, manifestPath);

    // Add any project host names as well as any configured host names
    const hostnames = [
      ...new Set([
        ...(manifest.endpoints ?? []),
        ...extractConfigHostNames(config as Record<string, string>),
      ]),
    ];

    const [entryPath] = await loader.getProject();

    const initProjectWorker = () =>
      workerFactory(
        manifest,
        entryPath,
        config as Record<string, string>,
        {
          ...permissions,
          env: false,
          net: hostnames,
          run: false,
          write: false,
        },
      );

    const [_worker, _conn, { tools, systemPrompt }] = await initProjectWorker();

    return new WebWorkerSandbox(
      manifest,
      systemPrompt,
      tools,
      initProjectWorker,
      timeout,
    );
  }

  private constructor(
    readonly manifest: ProjectManifest,
    readonly systemPrompt: string,
    tools: Tool[],
    initWorker: () => ReturnType<typeof workerFactory>,
    readonly timeout: number = 100,
  ) {
    this.#tools = tools;
    this.#initWorker = initWorker;
  }

  // deno-lint-ignore require-await
  async getTools(): Promise<Tool[]> {
    return this.#tools;
  }

  async runTool(
    toolName: string,
    args: unknown,
    ctx: IContext,
  ): Promise<string> {
    // Create a worker just for the tool call, this is so we can terminate if it exceeds the timeout.
    const [worker, conn] = await this.#initWorker();

    // Connect up context so sandbox can call application
    conn.onRequest(CtxVectorSearch, async (tableName, vector) => {
      const res = await ctx.vectorSearch(tableName, vector);

      // lancedb returns classes (Apache Arrow - Struct Row). It needs to be made serializable
      // This is done here as its specific to the webworker sandbox
      return res.map((r) => JSON.parse(JSON.stringify(r)));
    });
    conn.onRequest(CtxComputeQueryEmbedding, async (query) => {
      return await ctx.computeQueryEmbedding(query);
    });

    // Add timeout to the tool call, then clean up the worker.
    return Promise.race([
      timeout(this.timeout).then(() => {
        throw new Error(`Timeout calling tool ${toolName}`);
      }),
      conn.sendRequest(CallTool, toolName, args),
    ]).finally(() => {
      // Dispose of the worker, a new one will be created for each tool call
      worker.terminate();
    });
  }
}
