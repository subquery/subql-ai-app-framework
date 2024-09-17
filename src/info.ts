
import path from 'path';
import chalk from 'chalk';
import { UnsafeSandbox } from "./sandbox/index";

export async function projectInfo(projectPath: string, json = false): Promise<void> {
  const sandbox = await UnsafeSandbox.create(path.resolve(projectPath));

  if (json) {
    console.log(JSON.stringify({
      model: sandbox.model,
      config: sandbox.config,
      tools: (await sandbox.getTools()).map(t => t.function.name),
      systemPrompt: sandbox.systemPrompt,
    }, null, 2));
    return;
  }

  console.log(`${chalk.magentaBright('Project Information')}:
    ${chalk.blueBright('Model')}: \n\t${sandbox.model}
    ${chalk.blueBright('Config')}: \n${indentString(JSON.stringify(sandbox.config, null, 2))}
    ${chalk.blueBright('Tools')}: \n${indentString((await sandbox.getTools()).map(t => t.function.name).join('\n'))}
    ${chalk.blueBright('System Prompt')}: \n\t${indentString(sandbox.systemPrompt)}
  `);
}

function indentString(input: string): String {
  return input.split('\n').map(l => `\t${l}`).join('\n');
}
