import type { IContext } from "../context/context.ts";
import type { ISandbox } from "./sandbox.ts";
import type { Project, ProjectManifest } from "../project/project.ts";

export class MockSandbox implements ISandbox {
  constructor(
    readonly manifest: ProjectManifest,
    readonly project: Project,
  ) {}

  get systemPrompt(): string {
    return this.project.systemPrompt;
  }

  // deno-lint-ignore require-await
  async getTools() {
    return this.project.tools.map((t) => t.toTool());
  }

  runTool(toolName: string, args: unknown, ctx: IContext): Promise<string> {
    const tool = this.project.tools.find((t) => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return tool.call(args, ctx);
  }
}
