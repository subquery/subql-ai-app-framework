import type { Tool } from "ollama";
import {
  loadProject,
  type Project,
  type ProjectManifest,
} from "../project/project.ts";
import type { ISandbox } from "./sandbox.ts";
import type { IContext } from "../context/context.ts";
import type { Loader } from "../loader.ts";

/**
 * This class is considered unsafe as users code is directly required
 */
export class UnsafeSandbox implements ISandbox {
  #project: Project;

  public static async create(loader: Loader): Promise<UnsafeSandbox> {
    const [_, manifest] = await loader.getManifest();
    const [projectPath] = await loader.getProject();

    const { default: entry } = await import(projectPath);

    const project = await loadProject(manifest, entry);

    return new UnsafeSandbox(manifest, project);
  }

  private constructor(
    readonly manifest: ProjectManifest,
    readonly project: Project,
  ) {
    this.#project = project;
  }

  get systemPrompt(): string {
    return this.#project.systemPrompt;
  }

  // deno-lint-ignore require-await
  async getTools(): Promise<Tool[]> {
    return this.#project.tools.map((t) => t.toTool());
  }

  runTool(toolName: string, args: unknown, ctx: IContext): Promise<string> {
    const tool = this.project.tools.find((t) => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return tool.call(args, ctx);
  }
}
