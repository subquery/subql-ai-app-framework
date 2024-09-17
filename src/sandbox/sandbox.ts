import { type Tool } from "ollama";

/**
 * The sandbox provides a defined interface to run untrusted code
 * */
export interface ISandbox {

  model: string;

  systemPrompt: string;

  userMessage?: string;

  config?: any;

  getTools(): Promise<Tool[]>;

  runTool(toolName: string, args: any): Promise<any>;

  // TODO expand this interface with more untrusted data/functions. e.g RAG
}
