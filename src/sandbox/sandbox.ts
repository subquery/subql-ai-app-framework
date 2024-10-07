import type { Tool } from "ollama";
import type { TSchema } from "@sinclair/typebox";
import type { IContext } from "../context/context.ts";
import type { IVectorConfig } from "../project/project.ts";

/**
 * The sandbox provides a defined interface to run untrusted code
 */
export interface ISandbox {
  /**
   * The ollama model that will be used for the project
   */
  model: string;

  /**
   * The initial system prompt, this sets the global context
   */
  systemPrompt: string;

  /**
   * An optional message that can be presented to users at the start of a chat
   */
  userMessage?: string;

  vectorStorage?: IVectorConfig;

  config?: TSchema;

  getTools(): Promise<Tool[]>;

  runTool(toolName: string, args: unknown, ctx: IContext): Promise<string>;

  // TODO expand this interface with more untrusted data/functions. e.g RAG
}
