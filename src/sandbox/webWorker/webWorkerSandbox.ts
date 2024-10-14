import type { Tool } from "ollama";
import type { TSchema } from "@sinclair/typebox";
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
  GetConfig,
  Init,
  Load,
} from "./messages.ts";
import { loadConfigFromEnv } from "../../util.ts";
import { FromSchema } from "../../fromSchema.ts";
import type { IContext } from "../../context/context.ts";
import type { IVectorConfig } from "../../project/project.ts";
import { dirname } from "@std/path/dirname";

export type Permissions = {
  /**
   * For local projects allow reading all locations for imports to work.
   * TODO: This could be limited to the project dir + DENO_DIR cache but DENO_DIR doesn't provide the default currently
   */
  allowRead?: boolean;
  allowFFI?: boolean;
};

export class WebWorkerSandbox implements ISandbox {
  #connection: rpc.MessageConnection;
  #config: TSchema | undefined;
  #tools: Tool[];

  public static async create(
    path: string,
    permissions?: Permissions,
  ): Promise<WebWorkerSandbox> {
    const w = new Worker(
      import.meta.resolve("./webWorker.ts"),
      {
        type: "module",
        deno: {
          permissions: {
            env: false, // Should be passed through in loadConfigFromEnv below
            net: "inherit", // TODO remove localhost
            ffi: permissions?.allowFFI ?? false, // Needed for node js ffi, TODO this could be the same as read permissions
            read: permissions?.allowRead ? true : [dirname(path)],
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
    await conn.sendRequest(Load, path);

    const rawConfigType = await conn.sendRequest(GetConfig);

    // Need to restore the config and make it compatible as it uses symbols internally
    const configType = rawConfigType
      // @ts-ignore functionally works but types are too complex
      ? FromSchema(JSON.parse(JSON.stringify(rawConfigType)))
      : undefined;
    const config = loadConfigFromEnv(configType);
    const project = await conn.sendRequest(Init, config);

    return new WebWorkerSandbox(
      conn,
      configType,
      project.model,
      project.systemPrompt,
      project.tools,
      project.userMessage,
      project.vectorStorage,
    );
  }

  private constructor(
    connection: rpc.MessageConnection,
    config: TSchema | undefined,
    readonly model: string,
    readonly systemPrompt: string,
    tools: Tool[],
    readonly userMessage?: string,
    readonly vectorStorage?: IVectorConfig,
  ) {
    this.#connection = connection;
    this.#tools = tools;
    this.#config = config;
  }

  get config(): TSchema | undefined {
    return this.#config;
  }

  // deno-lint-ignore require-await
  async getTools(): Promise<Tool[]> {
    return this.#tools;
  }

  #hasSetupCxt = false;
  private setupCtxMethods(ctx: IContext) {
    if (this.#hasSetupCxt) return;
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
    this.#hasSetupCxt = true;
  }

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
