import { type ChatResponse, type Message, Ollama } from "ollama";
import type { IChatStorage } from "../chatStorage/index.ts";
import type { GenerateEmbedding } from "../embeddings/lance/writer.ts";
import OpenAI from "openai";
import { DEFAULT_LLM_HOST } from "../constants.ts";

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

    return async (input: string | string[], dimensions?: number) => {
      const { embeddings } = await ollama.embed({ model, input });
      // Ollama doesnt currentl allow specifying dimensions
      // https://github.com/ollama/ollama/issues/651
      if (dimensions != undefined && embeddings[0].length != dimensions) {
        throw new Error(
          `Dimensions mismatch, expected:"${dimensions}" received:"${
            embeddings[0].length
          }"`,
        );
      }
      return embeddings;
    };
  } catch (ollamaError) {
    try {
      const openai = new OpenAI({
        apiKey,
        baseURL: endpoint === DEFAULT_LLM_HOST ? undefined : endpoint,
      });

      await openai.models.retrieve(model);

      return async (input: string | string[], dimensions?: number) => {
        const { data } = await openai.embeddings.create({
          model,
          input,
          dimensions,
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
