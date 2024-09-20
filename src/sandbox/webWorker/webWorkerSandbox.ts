import { type Tool } from "ollama";
import { type TSchema } from '@sinclair/typebox';
import * as rpc from 'vscode-jsonrpc';
import { BrowserMessageReader, BrowserMessageWriter } from 'vscode-jsonrpc/browser.js';
import { ISandbox } from "../sandbox.ts";
import { Init, GetConfig, CallTool, Load } from './messages.ts';
import { loadConfigFromEnv } from "../../util.ts";
import { FromSchema } from "../../fromSchema.ts";

export class WebWorkerSandbox implements ISandbox {

    #connection: rpc.MessageConnection;
    #config: TSchema | undefined;
    #tools: Tool[];

    public static async create(path: string): Promise<WebWorkerSandbox> {
        const w = new Worker(
            import.meta.resolve('./webWorker.ts'/*path*/),
            {
                type: "module",
                deno: {
                    permissions: {
                      env: true, // TODO limit this
                      hrtime: false,
                      net: "inherit", // TODO remove localhost
                      ffi: true, // Needed for node js ffi
                      read: true, // Needed for imports to node modules
                      run: false,
                      write: false,
                    },
                  },
            }
        );

        // Setup a JSON RPC for interaction to the worker
        const conn = rpc.createMessageConnection(
            new BrowserMessageReader(w),
            new BrowserMessageWriter(w),
        );

        conn.listen()
        await conn.sendRequest(Load, path);

        const rawConfigType = await conn.sendRequest(GetConfig);

        // Need to restore the config and make it compatible as it uses symbols internally
        const configType = rawConfigType
            ? FromSchema(JSON.parse(JSON.stringify(rawConfigType)))
            : undefined
        const config = loadConfigFromEnv(configType);
        const project = await conn.sendRequest(Init, config);


        return new WebWorkerSandbox(
            conn,
            configType,
            project.model,
            project.prompt,
            project.tools,
            project.userMessage,
        )
    }
  
    private constructor(
        connection: rpc.MessageConnection,
        config: TSchema | undefined,
        readonly model: string,
        readonly systemPrompt: string,
        tools: Tool[],
        readonly userMessage?: string,
        
    ) {
        this.#connection = connection;
        this.#tools = tools;
        this.#config = config;
    }

    get config(): TSchema | undefined {
        return this.#config;
    }

    async getTools(): Promise<Tool[]> {
        return this.#tools;
    }

    runTool(toolName: string, args: any): Promise<any> {
        return this.#connection.sendRequest(CallTool, toolName, args);
    }
    
}