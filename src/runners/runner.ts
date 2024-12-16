import type { ChatResponse, Message } from "ollama";
import type { IChatStorage } from "../chatStorage/index.ts";

export interface IRunner {
  prompt(message: string): Promise<string>;
  promptMessages(messages: Message[]): Promise<ChatResponse>;
}

export interface IRunnerFactory {
  getRunner(chatStorage: IChatStorage): Promise<IRunner>;
}
