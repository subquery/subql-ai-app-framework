import { resolve } from "@std/path/resolve";
import { dirname } from "@std/path/dirname";
import ora from "ora";
import chalk from "chalk";
import { Message, Ollama } from "ollama";
import { MemoryChatStorage } from "./chatStorage/index.ts";
import { Runner } from "./runner.ts";
import { RunnerHost } from "./runnerHost.ts";
import { getDefaultSandbox } from "./sandbox/index.ts";
import { ChatResponse, http } from "./http.ts";
import { Context, IContext } from "./context/context.ts";
import { ISandbox } from "./sandbox/sandbox.ts";
import * as lancedb from "@lancedb/lancedb";

export async function runApp(config: {
  projectPath: string;
  host: string;
  interface: "cli" | "http";
  port: number;
}): Promise<void> {
  const model = new Ollama({ host: config.host });
  const sandbox = await getDefaultSandbox(resolve(config.projectPath));

  const ctx = await makeContext(sandbox, model, config.projectPath);

  const runnerHost = new RunnerHost(async () => {
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
      if (sandbox.userMessage) {
        console.log(sandbox.userMessage);
      }
      await cli(runnerHost);
      break;
    case "http":
    default:
      http(runnerHost, config.port);
      await httpCli(config.port);
  }
}

async function makeContext(
  sandbox: ISandbox,
  model: Ollama,
  projectPath: string,
): Promise<IContext> {
  if (!sandbox.vectorStorage) {
    return new Context(model);
  }

  const { type, path } = sandbox.vectorStorage;
  if (type !== "lancedb") {
    throw new Error("Only lancedb vector storage is supported");
  }
  const dbPath = resolve(dirname(projectPath), path);
  const connection = await lancedb.connect(dbPath);

  return new Context(model, connection);
}

function getPrompt(): string | null {
  const response = prompt(chalk.blueBright(`Enter a message: `));

  if (response === "/bye") {
    Deno.exit(0);
  }

  return response;
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
      text: `${chalk.magentaBright(res)}`,
    });
  }
}

async function httpCli(port: number): Promise<void> {
  const messages: Message[] = [];

  while (true) {
    const response = getPrompt();
    if (!response) {
      continue;
    }

    messages.push({ content: response, role: "user" });

    const spinner = ora({
      text: "",
      color: "yellow",
      spinner: "simpleDotsScrolling",
      discardStdin: false,
    }).start();

    const r = await fetch(`http://localhost:${port}/v1/chat/completions`, {
      method: "POST",
      body: JSON.stringify({
        messages,
        n: 1,
        stream: false,
      }),
    });

    if (!r.ok) {
      console.error("Response error", r.status, await r.text());
      throw new Error("Bad response");
    }

    const resBody: ChatResponse = await r.json();

    const res = resBody.choices[0]?.message;
    if (!res) {
      spinner.fail(chalk.redBright("Received invalid response message"));
      continue;
    }

    messages.push(res);

    spinner.stopAndPersist({
      text: `${chalk.magentaBright(res.content)}`,
    });
  }
}
