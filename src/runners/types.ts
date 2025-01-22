import type {
  ChatResponse as OllamaChatResponse,
  Message as OllamaMessage,
} from "ollama";

export interface Message extends OllamaMessage {
  id?: string;
  conversation_id?: string;
}

export interface ChatResponse extends OllamaChatResponse {
  message: Message;
}
