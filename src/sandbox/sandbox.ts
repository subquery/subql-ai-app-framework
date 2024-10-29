import type { Tool } from "ollama";
import type { IContext } from "../context/types.ts";
import type { ProjectManifest } from "../project/project.ts";

/**
 * The sandbox provides a defined interface to run untrusted code
 */
export interface ISandbox {
  manifest: ProjectManifest;

  systemPrompt: string;

  getTools(): Promise<Tool[]>;

  runTool(toolName: string, args: unknown, ctx: IContext): Promise<string>;
}
