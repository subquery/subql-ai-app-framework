import { Tool } from "ollama";
import { IProject, validateProject } from "../project/project";
import { ISandbox } from "./sandbox";

/**
 * This class is considered unsafe as users code is directly required
 * */
export class UnsafeSandbox implements ISandbox {

  #project: IProject;

  public static async create(path: string): Promise<UnsafeSandbox> {
    const project = await import(path);
    return new UnsafeSandbox(project.default);
  }

  private constructor(project: IProject) {
    this.#project = project;

    validateProject(this.#project);
  }

  get model(): string {
    return this.#project.model;
  }

  get systemPrompt(): string {
    return this.#project.prompt;
  }

  get userMessage(): string | undefined {
    return this.#project.userMessage;
  }

  async getTools(): Promise<Tool[]> {
    return this.#project.tools.map(t => t.toTool());
  }

  runTool(toolName: string, args: any): Promise<any> {
    const tool = this.#project.tools.find(t => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return tool.call(args);
  }
}
