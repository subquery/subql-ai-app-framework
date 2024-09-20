
import { resolve } from "@std/path/resolve";
import ora from 'ora';
import chalk from 'chalk';
import { Message } from 'ollama';
import { MemoryChatStorage } from "./chatStorage/index.ts";
import { Runner } from "./runner.ts";
import { RunnerHost } from "./runnerHost.ts";
import { getDefaultSandbox } from "./sandbox/index.ts";
import { ChatResponse, http } from './http.ts';

export async function runApp(config: {
  projectPath: string,
  host: string,
  interface: 'cli' | 'http',
  port: number,
}): Promise<void> {

  const sandbox = await getDefaultSandbox(resolve(config.projectPath));

  const runnerHost = new RunnerHost(async () => {
    const chatStorage = new MemoryChatStorage();

    chatStorage.append([{ role: 'system', content: sandbox.systemPrompt }]);

    return new Runner(
      sandbox,
      chatStorage,
      config.host,
    );
  });

  switch (config.interface) {
    case 'cli':
      if (sandbox.userMessage) {
        console.log(sandbox.userMessage);
      }
      await cli(runnerHost);
      break;
    case 'http':
    default:
      http(runnerHost, config.port);
      await httpCli(config.port);
  }
}

function getPrompt(): string | null {
  const response = prompt(chalk.blueBright(`Enter a message: `));

  if (response === '/bye') {
    Deno.exit(0);
  }

  return response;
}

async function cli(runnerHost: RunnerHost): Promise<void> {
  const runner = await runnerHost.getRunner('default');

  while (true) {
    const response = getPrompt();
    if (!response) {
      continue;
    }

    const spinner = ora({
      text: '',
      color: 'yellow',
      spinner: 'simpleDotsScrolling',
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

    messages.push({ content: response, role: 'user' });

    const spinner = ora({
      text: '',
      color: 'yellow',
      spinner: 'simpleDotsScrolling',
      discardStdin: false,
    }).start();

    const r = await fetch(`http://localhost:${port}/v1/chat/completions`, {
      method: 'POST',
      body: JSON.stringify({
        messages,
        n: 1,
        stream: false,
      })
    });

    if (!r.ok) {
      console.error('Response error', r.status, await r.text());
      throw new Error("Bad response");
    }

    const resBody: ChatResponse = await r.json();

    const res = resBody.choices[0]?.message;
    if (!res) {
      spinner.fail(chalk.redBright('Received invalid response message'));
      continue;
    }

    messages.push(res);

    spinner.stopAndPersist({
      text: `${chalk.magentaBright(res.content)}`,
    });
  }

}
