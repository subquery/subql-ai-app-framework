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
  Load,
} from "./messages.ts";
import { loadRawConfigFromEnv, type Source } from "../../util.ts";
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

export class WebWorkerSandbox implements ISandbox {
  #connection: rpc.MessageConnection;

  #tools: Tool[];

  public static async create(
    loader: Loader,
  ): Promise<WebWorkerSandbox> {
    const [manifestPath, manifest, source] = await loader.getManifest();

    const permissions = getPermisionsForSource(source, manifestPath);

    const w = new Worker(
      import.meta.resolve("./webWorker.ts"),
      {
        type: "module",
        deno: {
          permissions: {
            ...permissions,
            env: true, // Should be passed through in loadConfigFromEnv below
            net: manifest.endpoints, // TODO add config endpoints
            run: false,
            write: false,
          },
        },
      },
    );

    // Setup a JSON RPC for interaction to the worker
    const conn = rpc.createMessageConnection(
      new BrowserMessageReader(w),
      new BrowserMessageWriter(w),
    );

    conn.listen();

    const [entryPath] = await loader.getProject();
    await conn.sendRequest(Load, entryPath);

    const config = loadRawConfigFromEnv(manifest.config);
    const { tools, systemPrompt } = await conn.sendRequest(
      Init,
      manifest,
      config,
    );

    return new WebWorkerSandbox(
      conn,
      manifest,
      systemPrompt,
      tools,
    );
  }

  private constructor(
    connection: rpc.MessageConnection,
    readonly manifest: ProjectManifest,
    readonly systemPrompt: string,
    tools: Tool[],
  ) {
    this.#tools = tools;
    this.#connection = connection;
  }

  // deno-lint-ignore require-await
  async getTools(): Promise<Tool[]> {
    return this.#tools;
  }

  // #hasSetupCxt = false;
  // private setupCtxMethods(ctx: IContext) {
  //   if (this.#hasSetupCxt) return;
  //   // Connect up context so sandbox can call application
  //   this.#connection.onRequest(CtxVectorSearch, async (tableName, vector) => {
  //     const res = await ctx.vectorSearch(tableName, vector);

  //     // lancedb returns classes (Apache Arrow - Struct Row). It needs to be made serializable
  //     // This is done here as its specific to the webworker sandbox
  //     return res.map((r) => JSON.parse(JSON.stringify(r)));
  //   });
  //   this.#connection.onRequest(CtxComputeQueryEmbedding, async (query) => {
  //     return await ctx.computeQueryEmbedding(query);
  //   });
  //   this.#hasSetupCxt = true;
  // }

  runTool(toolName: string, args: unknown, ctx: IContext): Promise<string> {
    // Connect up context so sandbox can call application
    this.#connection.onRequest(CtxVectorSearch, async (tableName, vector) => {
      const res = await ctx.vectorSearch(tableName, vector);

      // lancedb returns classes (Apache Arrow - Struct Row). It needs to be made serializable
      // This is done here as its specific to the webworker sandbox
      return res.map((r) => JSON.parse(JSON.stringify(r)));
    });
    this.#connection.onRequest(CtxComputeQueryEmbedding, async (query) => {
      return await ctx.computeQueryEmbedding(query);
    });

    return this.#connection.sendRequest(CallTool, toolName, args);
  }
}
