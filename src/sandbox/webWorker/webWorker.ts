import * as rpc from "vscode-jsonrpc";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
} from "vscode-jsonrpc/browser.js";
import {
  CallTool,
  CtxComputeQueryEmbedding,
  CtxVectorSearch,
  GetConfig,
  Init,
  type IProjectJson,
  Load,
} from "./messages.ts";

import {
  getProjectFromEntrypoint,
  type IProject,
  type IProjectEntrypoint,
} from "../../project/project.ts";
import type { IContext } from "../../context/context.ts";

const conn = rpc.createMessageConnection(
  new BrowserMessageReader(self),
  new BrowserMessageWriter(self),
);

let entrypoint: IProjectEntrypoint;
let project: IProject;

const context = {
  vectorSearch: (table, vectors) =>
    conn.sendRequest(CtxVectorSearch, table, vectors),
  computeQueryEmbedding: (query) =>
    conn.sendRequest(CtxComputeQueryEmbedding, query),
} satisfies IContext;

function toJsonProject(): IProjectJson {
  const { tools, ...rest } = project;
  return {
    ...rest,
    tools: tools.map((t) => t.toTool()),
  };
}

conn.onRequest(Load, async (path) => {
  entrypoint ??= (await import(path)).entrypoint;
});

conn.onRequest(Init, async (config) => {
  if (!entrypoint) {
    throw new Error("Please call `load` first");
  }

  project ??= await getProjectFromEntrypoint(entrypoint, config);

  return toJsonProject();
});

conn.onRequest(GetConfig, () => {
  if (!entrypoint) {
    throw new Error("Project is not initialized");
  }
  return entrypoint.configType;
});

conn.onRequest(CallTool, (toolName, args) => {
  if (!project) {
    throw new Error("Project is not initialized");
  }

  const tool = project.tools.find((t) => t.name === toolName);

  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  return tool.call(args, context);
});

conn.listen();
