import { type Tool } from "ollama";
import { TSchema } from "@sinclair/typebox";

/**
 * The sandbox provides a defined interface to run untrusted code
 * */
export interface ISandbox {

  model: string;

  systemPrompt: string;

  userMessage?: string;

  config?: TSchema;

  getTools(): Promise<Tool[]>;

  runTool(toolName: string, args: any): Promise<any>;

  // TODO expand this interface with more untrusted data/functions. e.g RAG
}
