import { resolve } from "@std/path/resolve";
import ora from "ora";
import { brightBlue, brightMagenta, brightRed } from "@std/fmt/colors";
import { Message, Ollama } from "ollama";
import { MemoryChatStorage } from "./chatStorage/index.ts";
import { Runner } from "./runner.ts";
import { RunnerHost } from "./runnerHost.ts";
import { getDefaultSandbox } from "./sandbox/index.ts";
import { ChatResponse, http } from "./http.ts";
import { Context, IContext } from "./context/context.ts";
import { ISandbox } from "./sandbox/sandbox.ts";
import * as lancedb from "@lancedb/lancedb";
import { IPFSClient } from "./ipfs.ts";
import { loadProject, loadVectorStoragePath } from "./loader.ts";

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

  const ctx = await makeContext(
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

function getPrompt(): string | null {
  const response = prompt(brightBlue(`Enter a message: `));

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
      text: `${brightMagenta(res)}`,
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
      spinner.fail(brightRed("Received invalid response message"));
      continue;
    }

    messages.push(res);

    spinner.stopAndPersist({
      text: `${brightMagenta(res.content)}`,
    });
  }
}
