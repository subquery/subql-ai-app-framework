import type { ChatResponse, Message } from "ollama";
import type { IChatStorage } from "../chatStorage/index.ts";
import type { IContext } from "../context/types.ts";

export interface IRunner {
  prompt(message: string): Promise<string>;
  promptMessages(messages: Message[]): Promise<ChatResponse>;
}

export interface IRunnerFactory {
  getContext(): Promise<IContext>;
  getRunner(chatStorage: IChatStorage): Promise<IRunner>;
}
