import { IContext } from "../context/context.ts";
import { ITool } from "../tool.ts";
import { ISandbox } from "./sandbox.ts";

export class MockSandbox implements ISandbox {
  constructor(
    readonly model: string,
    readonly systemPrompt: string,
    private tools: ITool[],
    readonly userMessage?: string,
    readonly config?: any,
  ) {}

  async getTools() {
    return this.tools.map((t) => t.toTool());
  }

  async runTool(toolName: string, args: any, ctx: IContext): Promise<any> {
    const tool = this.tools.find((t) => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return tool.call(args, ctx);
  }
}
