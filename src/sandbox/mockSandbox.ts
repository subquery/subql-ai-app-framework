import { TSchema } from "@sinclair/typebox";
import { IContext } from "../context/context.ts";
import { ITool } from "../tool.ts";
import { ISandbox } from "./sandbox.ts";

export class MockSandbox implements ISandbox {
  constructor(
    readonly model: string,
    readonly systemPrompt: string,
    private tools: ITool[],
    readonly userMessage?: string,
    readonly config?: TSchema,
  ) {}

  // deno-lint-ignore require-await
  async getTools() {
    return this.tools.map((t) => t.toTool());
  }

  runTool(toolName: string, args: unknown, ctx: IContext): Promise<string> {
    const tool = this.tools.find((t) => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return tool.call(args, ctx);
  }
}
