import { resolve } from "@std/path/resolve";
import { brightBlue, brightMagenta } from "@std/fmt/colors";
import { getDefaultSandbox } from "./sandbox/index.ts";
import { IProject } from "./project/project.ts";
import { TSchema } from "@sinclair/typebox";
import { IPFSClient } from "./ipfs.ts";
import { loadProject } from "./loader.ts";

export async function getProjectJson(
  projectPath: string,
  sandboxFactory = getDefaultSandbox,
): Promise<Omit<IProject, "tools"> & { tools: string[]; config?: TSchema }> {
  const sandbox = await sandboxFactory(resolve(projectPath));

  return {
    model: sandbox.model,
    config: sandbox.config,
    tools: (await sandbox.getTools()).map((t) => t.function.name),
    systemPrompt: sandbox.systemPrompt,
    vectorStorage: sandbox.vectorStorage,
  };
}

export async function projectInfo(
  projectPath: string,
  ipfs: IPFSClient,
  json = false,
): Promise<void> {
  const loadedPath = await loadProject(projectPath, ipfs);
  const projectJson = await getProjectJson(loadedPath);

  if (json) {
    console.log(JSON.stringify(
      projectJson,
      null,
      2,
    ));
    return;
  }

  const info: [string, string][] = [
    ["Model", projectJson.model],
    ["Conifg", JSON.stringify(projectJson.config, null, 2)],
    ["Tools", projectJson.tools.join("\n")],
    ["System Prompt", projectJson.systemPrompt],
  ];

  if (projectJson.vectorStorage) {
    info.push([
      "Vector Storage",
      `Type: ${projectJson.vectorStorage.type}\nPath: ${projectJson.vectorStorage.path}`,
    ]);
  }

  console.log(`${brightMagenta("Project Information")}:
${
    info.map(([key, value]) =>
      `    ${brightBlue(key)}:\n${indentString(value)}`
    ).join("\n")
  }
  `);
}

function indentString(input: string): string {
  return input.split("\n").map((l) => `\t${l}`).join("\n");
}
