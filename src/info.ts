import { resolve } from "@std/path/resolve";
import chalk from "chalk";
import { getDefaultSandbox } from "./sandbox/index.ts";

export async function projectInfo(
  projectPath: string,
  json = false,
): Promise<void> {
  const sandbox = await getDefaultSandbox(resolve(projectPath));

  if (json) {
    console.log(JSON.stringify(
      {
        model: sandbox.model,
        config: sandbox.config,
        tools: (await sandbox.getTools()).map((t) => t.function.name),
        systemPrompt: sandbox.systemPrompt,
        vectorStorage: sandbox.vectorStorage,
      },
      null,
      2,
    ));
    return;
  }

  const info: [string, string][] = [
    ["Model", sandbox.model],
    ["Conifg", JSON.stringify(sandbox.config, null, 2)],
    [
      "Tools",
      (await sandbox.getTools()).map((t) => t.function.name).join("\n"),
    ],
    ["System Prompt", sandbox.systemPrompt],
  ];

  if (sandbox.vectorStorage) {
    info.push([
      "Vector Storage",
      `Type: ${sandbox.vectorStorage.type}\nPath: ${sandbox.vectorStorage.path}`,
    ]);
  }

  console.log(`${chalk.magentaBright("Project Information")}:
${
    info.map(([key, value]) =>
      `    ${chalk.blueBright(key)}:\n${indentString(value)}`
    ).join("\n")
  }
  `);
}

function indentString(input: string): string {
  return input.split("\n").map((l) => `\t${l}`).join("\n");
}
