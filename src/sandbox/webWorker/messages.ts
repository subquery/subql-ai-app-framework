import { type Tool } from "ollama";
import { type TSchema } from '@sinclair/typebox';
import * as rpc from 'vscode-jsonrpc';
import { type IProject } from "../../project/project.ts";

export type IProjectJson = Omit<IProject, "tools"> & { tools: Tool[] };

export const Load = new rpc.RequestType<string, void, string>('load');
export const Init = new rpc.RequestType<Record<string, unknown>, IProjectJson, string>('init');
export const GetConfig = new rpc.RequestType0<TSchema | undefined, void>('get_config');
export const CallTool = new rpc.RequestType2<string, any, any, void>('call_tool');
