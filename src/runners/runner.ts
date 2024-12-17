import { type ChatResponse, type Message, Ollama } from "ollama";
import type { IChatStorage } from "../chatStorage/index.ts";
import type { GenerateEmbedding } from "../embeddings/lance/writer.ts";
import OpenAI from "openai";

export interface IRunner {
  prompt(message: string): Promise<string>;
  promptMessages(messages: Message[]): Promise<ChatResponse>;
}

export interface IRunnerFactory {
  getRunner(chatStorage: IChatStorage): Promise<IRunner>;
}

export async function getGenerateFunction(
  endpoint: string,
  model: string,
  apiKey?: string,
): Promise<GenerateEmbedding> {
  try {
    const ollama = new Ollama({ host: endpoint });

    // If this throws then try OpenAI
    await ollama.show({ model });

    return async (input: string | string[]) => {
      const { embeddings } = await ollama.embed({ model, input });
      return embeddings;
    };
  } catch (ollamaError) {
    try {
      const openai = new OpenAI({
        apiKey,
        baseURL: endpoint,
      });

      await openai.models.retrieve(model);

      return async (input: string | string[]) => {
        const { data } = await openai.embeddings.create({
          model,
          input,
        });

        return data.map((d) => d.embedding);
      };
    } catch (openAIError) {
      throw new Error(`Unable to find model: ${model}.
        Ollama error: ${ollamaError}
        Openai error: ${openAIError}`);
    }
  }
}
