import { type Tool } from "ollama";
import { type TSchema } from "@sinclair/typebox";
import * as rpc from "vscode-jsonrpc";
import { type IProject } from "../../project/project.ts";

export type IProjectJson = Omit<IProject, "tools"> & { tools: Tool[] };

// Framework -> Sandbox
export const Load = new rpc.RequestType<string, void, string>("load");
export const Init = new rpc.RequestType<
  Record<string, unknown>,
  IProjectJson,
  string
>("init");
export const GetConfig = new rpc.RequestType0<TSchema | undefined, void>(
  "get_config",
);
export const CallTool = new rpc.RequestType2<string, any, any, void>(
  "call_tool",
);

// Sandbox -> Framework
export const CtxVectorSearch = new rpc.RequestType2<
  string,
  number[],
  any,
  void
>("ctx_vector_search");
export const CtxComputeQueryEmbedding = new rpc.RequestType<
  string,
  number[],
  void
>("ctx_compute_query_embedding");
