import { Message } from "ollama";


export interface IChatStorage {

  /**
   * Gets all messages from the chat history
   * */
  getHistory(): Promise<Message[]>;

  /**
   * Appends any new messages to the chat history
   * */
  append(messages: Message[]): Promise<void>;
}
