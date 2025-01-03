import ora from "ora";
import { brightMagenta } from "@std/fmt/colors";
import { Ollama } from "ollama";
import { MemoryChatStorage } from "./chatStorage/index.ts";
import { Runner } from "./runner.ts";
import { RunnerHost } from "./runnerHost.ts";
import { getDefaultSandbox } from "./sandbox/index.ts";
import { http } from "./http.ts";
import { Context } from "./context/context.ts";
import type { IContext } from "./context/types.ts";
import type { ISandbox } from "./sandbox/sandbox.ts";
import * as lancedb from "@lancedb/lancedb";
import type { IPFSClient } from "./ipfs.ts";
import { Loader } from "./loader.ts";
import { fromFileUrlSafe, getPrompt, getVersion } from "./util.ts";
import { getLogger } from "./logger.ts";

const logger = await getLogger("app");

export async function runApp(config: {
  projectPath: string;
  host: string;
  interface: "cli" | "http";
  port: number;
  ipfs: IPFSClient;
  forceReload?: boolean;
  toolTimeout: number;
  streamKeepAlive: number;
  cacheDir?: string;
}): Promise<void> {
  logger.info(`Subql AI Framework (${await getVersion()})`);

  const model = new Ollama({ host: config.host });

  const loader = new Loader(
    config.projectPath,
    config.ipfs,
    config.cacheDir,
    config.forceReload,
  );

  const sandbox = await getDefaultSandbox(loader, config.toolTimeout);

  // Check that Ollama can be reached and the models exist
  try {
    await model.show({ model: sandbox.manifest.model });
  } catch (e) {
    if (e instanceof TypeError && e.message.includes("Connection refused")) {
      throw new Error(
        "Unable to reach Ollama, please check your `host` option.",
        { cause: e },
      );
    }
    throw e;
  }

  if (sandbox.manifest.embeddingsModel) {
    await model.show({ model: sandbox.manifest.embeddingsModel });
  }

  const ctx = await makeContext(
    sandbox,
    model,
    loader,
  );

  const runnerHost = new RunnerHost(() => {
    const chatStorage = new MemoryChatStorage();

    chatStorage.append([{ role: "system", content: sandbox.systemPrompt }]);

    return new Runner(
      sandbox,
      chatStorage,
      model,
      ctx,
    );
  });

  switch (config.interface) {
    case "cli":
      await cli(runnerHost);
      break;
    case "http":
    default:
      http(runnerHost, config.port, config.streamKeepAlive);
  }
}

async function makeContext(
  sandbox: ISandbox,
  model: Ollama,
  loader: Loader,
): Promise<IContext> {
  if (!sandbox.manifest.vectorStorage) {
    return new Context(model);
  }

  const { type } = sandbox.manifest.vectorStorage;
  if (type !== "lancedb") {
    throw new Error("Only lancedb vector storage is supported");
  }

  const loadRes = await loader.getVectorDb();
  if (!loadRes) throw new Error("Failed to load vector db");
  const connection = await lancedb.connect(fromFileUrlSafe(loadRes[0]));

  return new Context(model, connection, sandbox.manifest.embeddingsModel);
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
