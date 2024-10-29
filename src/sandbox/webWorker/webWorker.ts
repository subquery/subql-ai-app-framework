import * as rpc from "vscode-jsonrpc";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
} from "vscode-jsonrpc/browser.js";
import {
  CallTool,
  CtxComputeQueryEmbedding,
  CtxVectorSearch,
  Init,
  type IProjectJson,
  Load,
} from "./messages.ts";

import type { Project } from "../../project/project.ts";
import type { IContext } from "../../context/types.ts";
import { PrettyTypeboxError } from "../../util.ts";
import { loadProject } from "../../project/project.ts";

const conn = rpc.createMessageConnection(
  new BrowserMessageReader(self),
  new BrowserMessageWriter(self),
);

let entrypoint: unknown;
let project: Project;

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
  entrypoint ??= (await import(path)).default;
});

conn.onRequest(Init, async (manifest, config) => {
  if (!entrypoint) {
    throw new Error("Please call `load` first");
  }

  try {
    project ??= await loadProject(manifest, entrypoint, config);

    return toJsonProject();
  } catch (e: unknown) {
    if (e instanceof Error) {
      throw PrettyTypeboxError(e, "Project validation failed");
    }
    throw e;
  }
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
