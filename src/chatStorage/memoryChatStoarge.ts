import { Message } from "ollama";
import { IChatStorage } from "./chatStorage.ts";


export class MemoryChatStorage implements IChatStorage {
  private messages: Message[] = [];

  async getHistory(): Promise<Message[]> {
    return this.messages;
  }

  async append(messages: Message[]): Promise<void> {
    this.messages.push(...messages);
  }
}
