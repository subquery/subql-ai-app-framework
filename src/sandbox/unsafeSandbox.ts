import type { Tool } from "ollama";
import {
  getProjectFromEntrypoint,
  type IProject,
  type IVectorConfig,
  validateProject,
} from "../project/project.ts";
import type { ISandbox } from "./sandbox.ts";
import type { IContext } from "../context/context.ts";

/**
 * This class is considered unsafe as users code is directly required
 */
export class UnsafeSandbox implements ISandbox {
  #project: IProject;

  public static async create(path: string): Promise<UnsafeSandbox> {
    const p = await import(path);

    const project = await getProjectFromEntrypoint(p.entrypoint);

    return new UnsafeSandbox(project);
  }

  private constructor(project: IProject) {
    this.#project = project;

    validateProject(this.#project);
  }

  get model(): string {
    return this.#project.model;
  }

  // get config(): TSchema {
  //   return this.#project.config;
  // }

  get systemPrompt(): string {
    return this.#project.systemPrompt;
  }

  get userMessage(): string | undefined {
    return this.#project.userMessage;
  }

  get vectorStorage(): IVectorConfig | undefined {
    return this.#project.vectorStorage;
  }

  // deno-lint-ignore require-await
  async getTools(): Promise<Tool[]> {
    return this.#project.tools.map((t) => t.toTool());
  }

  runTool(toolName: string, args: unknown, ctx: IContext): Promise<string> {
    const tool = this.#project.tools.find((t) => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return tool.call(args, ctx);
  }
}
