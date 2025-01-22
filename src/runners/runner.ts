import { Ollama } from "ollama";
import type { IChatStorage } from "../chatStorage/index.ts";
import type { GenerateEmbedding } from "../embeddings/lance/writer.ts";
import OpenAI from "openai";
import { DEFAULT_LLM_HOST } from "../constants.ts";
import type { ISandbox } from "../sandbox/sandbox.ts";
import type { Loader } from "../loader.ts";
import { OpenAIRunnerFactory } from "./openai.ts";
import { OllamaRunnerFactory } from "./ollama.ts";
import type { ChatResponse, Message } from "./types.ts";

export interface IRunner {
  prompt(message: string): Promise<string>;
  promptMessages(messages: Message[]): Promise<ChatResponse>;
}

export interface IRunnerFactory {
  getRunner(chatStorage: IChatStorage): Promise<IRunner>;
}

async function runForModels<T>(
  runners: Record<string, () => Promise<T>>,
): Promise<T> {
  const errors: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(runners)) {
    try {
      return await fn();
    } catch (e) {
      errors[name] = e;
    }
  }

  throw new Error(`All options failed to run:
\t${
    Object.entries(errors)
      .map(([name, error]) => `${name} error: ${error}`)
      .join("\n\t")
  }`);
}

export function createRunner(
  endpoint: string,
  sandbox: ISandbox,
  loader: Loader,
  openAiApiKey?: string,
): Promise<IRunnerFactory> {
  return runForModels<IRunnerFactory>({
    Ollama: () => OllamaRunnerFactory.create(endpoint, sandbox, loader),
    OpenAI: () =>
      OpenAIRunnerFactory.create(
        endpoint === DEFAULT_LLM_HOST ? undefined : endpoint,
        openAiApiKey,
        sandbox,
        loader,
      ),
  });
}

export function getGenerateFunction(
  endpoint: string,
  model: string,
  apiKey?: string,
): Promise<GenerateEmbedding> {
  return runForModels<GenerateEmbedding>({
    Ollama: async () => {
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
    },
    OpenAI: async () => {
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
    },
  });
}
