import { type Tool } from "ollama";
import { TSchema } from "@sinclair/typebox";
import { IContext } from "../context/context.ts";
import { IVectorConfig } from "../project/project.ts";

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

  runTool(toolName: string, args: any, ctx: IContext): Promise<any>;

  // TODO expand this interface with more untrusted data/functions. e.g RAG
}
