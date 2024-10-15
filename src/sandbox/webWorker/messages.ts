import type { Tool } from "ollama";
import * as rpc from "vscode-jsonrpc";
import type { ProjectManifest } from "../../project/project.ts";

export type IProjectJson = { tools: Tool[]; systemPrompt: string };

// Framework -> Sandbox
export const Load = new rpc.RequestType<string, void, string>("load");
export const Init = new rpc.RequestType2<
  ProjectManifest,
  Record<string, string>,
  IProjectJson,
  string
>("init");
export const CallTool = new rpc.RequestType2<string, unknown, string, void>(
  "call_tool",
);

// Sandbox -> Framework
export const CtxVectorSearch = new rpc.RequestType2<
  string,
  number[],
  unknown[],
  void
>("ctx_vector_search");
export const CtxComputeQueryEmbedding = new rpc.RequestType<
  string,
  number[],
  void
>("ctx_compute_query_embedding");
