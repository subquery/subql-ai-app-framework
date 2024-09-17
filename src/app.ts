
import { resolve } from "@std/path/resolve";
import ora from 'ora';
import chalk from 'chalk';
import { MemoryChatStorage } from "./chatStorage/index.ts";
import { Runner } from "./runner.ts";
import { RunnerHost } from "./runnerHost.ts";
import { UnsafeSandbox } from "./sandbox/index.ts";

export async function runApp(config: {
  projectPath: string,
  host: string,
  interface: 'cli' | 'http',
}): Promise<void> {

  const sandbox = await UnsafeSandbox.create(resolve(config.projectPath));

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
    case 'http':
    default:
      throw new Error(`Only "cli" interface is supported currently`);
  }
}

async function cli(runnerHost: RunnerHost): Promise<void> {
  const runner = await runnerHost.getRunner('default');

  while(true) {
    const response = prompt(chalk.blueBright(`Enter a message: `));

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

//https://platform.openai.com/docs/api-reference/chat/create
async function http(runnerHost: RunnerHost, port: number): Promise<void> {

}
