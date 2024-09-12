
import path from 'path';
import readline from 'readline/promises';
import { MemoryChatStorage } from "./chatStorage/index";
import { Runner } from "./runner";
import { RunnerHost } from "./runnerHost";
import { UnsafeSandbox } from "./sandbox/index";
import ora from 'ora';
import chalk from 'chalk';

export async function runApp(config: {
  projectPath: string,
  host: string,
  interface: 'cli' | 'http',
}): Promise<void> {

  const sandbox = await UnsafeSandbox.create(path.resolve(config.projectPath));

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

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while(true) {
    const response = await rl.question(chalk.blueBright(`Enter a message: `));

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
