import { brightBlue, brightMagenta } from "@std/fmt/colors";
import { getDefaultSandbox } from "../sandbox/index.ts";
import type { ProjectManifest } from "../project/project.ts";
import type { IPFSClient } from "../ipfs.ts";
import { Loader } from "../loader.ts";

type StaticProject = ProjectManifest & {
  tools?: string[];
  systemPrompt?: string;
};

export async function getProjectJson(
  manifest: ProjectManifest,
  loader: Loader,
  sandboxFactory = getDefaultSandbox,
): Promise<StaticProject> {
  try {
    const sandbox = await sandboxFactory(loader, 10_000);

    return {
      ...sandbox.manifest,
      tools: (await sandbox.getTools()).map((t) => t.function.name),
      systemPrompt: sandbox.systemPrompt,
    };
  } catch (e) {
    console.warn(`Failed to load project: ${e}`);
    return manifest;
  }
}

export async function projectInfo(
  projectPath: string,
  ipfs: IPFSClient,
  json = false,
  cacheDir?: string,
): Promise<void> {
  const loader = new Loader(projectPath, ipfs, cacheDir);
  const [_, manifest] = await loader.getManifest();
  const staticProject = await getProjectJson(manifest, loader);

  if (json) {
    console.log(JSON.stringify(
      staticProject,
      null,
      2,
    ));
    return;
  }

  const info: [string, string][] = [
    ["Model", staticProject.model],
    ["Conifg", JSON.stringify(staticProject.config, null, 2)],
    ["Tools", staticProject.tools?.join("\n") ?? "No Tools found"],
    ["System Prompt", staticProject?.systemPrompt ?? "No System Prompt found"],
  ];

  if (manifest.endpoints?.length) {
    info.push(["Endpoints", manifest.endpoints.join("\n")]);
  }

  if (staticProject.vectorStorage) {
    info.push([
      "Vector Storage",
      `Type: ${staticProject.vectorStorage.type}\nPath: ${staticProject.vectorStorage.path}`,
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
