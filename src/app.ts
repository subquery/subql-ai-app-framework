import ora from "ora";
import { brightMagenta } from "@std/fmt/colors";
import { MemoryChatStorage } from "./chatStorage/index.ts";
import { RunnerHost } from "./runnerHost.ts";
import { getDefaultSandbox } from "./sandbox/index.ts";
import { http } from "./http.ts";
import type { IPFSClient } from "./ipfs.ts";
import { Loader } from "./loader.ts";
import { getPrompt, getVersion } from "./util.ts";
import { getLogger } from "./logger.ts";
import { createRunner } from "./runners/runner.ts";

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
  openAiApiKey?: string;
}): Promise<void> {
  logger.info(`Subql AI Framework (${await getVersion()})`);

  const loader = new Loader(
    config.projectPath,
    config.ipfs,
    config.cacheDir,
    config.forceReload
  );

  const sandbox = await getDefaultSandbox(loader, config.toolTimeout);

  const runnerFactory = await createRunner(
    config.host,
    sandbox,
    loader,
    config.openAiApiKey
  );

  const runnerHost = new RunnerHost(() => {
    const chatStorage = new MemoryChatStorage();

    chatStorage.append([{ role: "system", content: sandbox.systemPrompt }]);

    return runnerFactory.getRunner(chatStorage);
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
