import { resolve } from "@std/path/resolve";
import ora from "ora";
import { brightMagenta } from "@std/fmt/colors";
import { Ollama } from "ollama";
import { MemoryChatStorage } from "./chatStorage/index.ts";
import { Runner } from "./runner.ts";
import { RunnerHost } from "./runnerHost.ts";
import { getDefaultSandbox } from "./sandbox/index.ts";
import { http } from "./http.ts";
import { Context, type IContext } from "./context/context.ts";
import type { ISandbox } from "./sandbox/sandbox.ts";
import * as lancedb from "@lancedb/lancedb";
import type { IPFSClient } from "./ipfs.ts";
import { loadProject, loadVectorStoragePath } from "./loader.ts";
import { getPrompt } from "./util.ts";

export async function runApp(config: {
  projectPath: string;
  host: string;
  interface: "cli" | "http";
  port: number;
  ipfs: IPFSClient;
  forceReload?: boolean;
}): Promise<void> {
  const model = new Ollama({ host: config.host });
  const projectPath = await loadProject(
    config.projectPath,
    config.ipfs,
    undefined,
    config.forceReload,
  );
  const sandbox = await getDefaultSandbox(resolve(projectPath));

  const pendingCtx = makeContext(
    sandbox,
    model,
    (dbPath) =>
      loadVectorStoragePath(
        projectPath,
        dbPath,
        config.ipfs,
        undefined,
        config.forceReload,
      ),
  );

  const runnerHost = new RunnerHost(async () => {
    const chatStorage = new MemoryChatStorage();

    chatStorage.append([{ role: "system", content: sandbox.systemPrompt }]);

    return new Runner(
      sandbox,
      chatStorage,
      model,
      await pendingCtx,
    );
  });

  switch (config.interface) {
    case "cli":
      if (sandbox.userMessage) {
        console.log(sandbox.userMessage);
      }
      await cli(runnerHost);
      break;
    case "http":
    default:
      http(runnerHost, config.port, pendingCtx);
  }
}

async function makeContext(
  sandbox: ISandbox,
  model: Ollama,
  loadVectorStoragePath: (vectorStoragePath: string) => Promise<string>,
): Promise<IContext> {
  if (!sandbox.vectorStorage) {
    return new Context(model);
  }

  const { type, path } = sandbox.vectorStorage;
  if (type !== "lancedb") {
    throw new Error("Only lancedb vector storage is supported");
  }
  const dbPath = await loadVectorStoragePath(path);
  const connection = await lancedb.connect(dbPath);

  return new Context(model, connection);
}

async function cli(runnerHost: RunnerHost): Promise<void> {
  const runner = await runnerHost.getRunner("default");

  while (true) {
    const response = getPrompt();
    if (!response) {
      continue;
    }

    const spinner = ora({
      text: "",
      color: "yellow",
      spinner: "simpleDotsScrolling",
      discardStdin: false,
    }).start();

    const res = await runner.prompt(response);

    spinner.stopAndPersist({
      text: `${brightMagenta(res)}`,
    });
  }
}
