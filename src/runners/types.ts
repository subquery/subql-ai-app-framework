import {
  type Message as OllamaMessage,
  ChatResponse as OllamaChatResponse,
} from "ollama";

export interface Message extends OllamaMessage {
  id?: string;
  conversation_id?: string;
}

export interface ChatResponse extends OllamaChatResponse {
  message: Message;
}
