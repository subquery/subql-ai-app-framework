import type { Message } from "ollama";
import type { IChatStorage } from "./chatStorage.ts";

export class MemoryChatStorage implements IChatStorage {
  private messages: Message[] = [];

  // deno-lint-ignore require-await
  async getHistory(): Promise<Message[]> {
    return this.messages;
  }

  // deno-lint-ignore require-await
  async append(messages: Message[]): Promise<void> {
    this.messages.push(...messages);
  }
}
