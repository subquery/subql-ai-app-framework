import type { ChatResponse, Message } from "ollama";
import type { IRunner, IRunnerFactory } from "./runner.ts";
import OpenAI from "openai";
import type { IChatStorage } from "../chatStorage/chatStorage.ts";
import type { ISandbox } from "../sandbox/sandbox.ts";
import type { IContext } from "../context/types.ts";
import { Memoize } from "../decorators.ts";
import type { Loader } from "../loader.ts";
import { fromFileUrlSafe } from "../util.ts";
import * as lancedb from "@lancedb/lancedb";
import { Context } from "../context/context.ts";
import type {
  ChatCompletionMessageParam,
  ParsedChatCompletion,
} from "openai/resources";

export class OpenAIRunnerFactory implements IRunnerFactory {
  #openai: OpenAI;
  #sandbox: ISandbox;
  #loader: Loader;

  private constructor(
    openAI: OpenAI,
    sandbox: ISandbox,
    loader: Loader,
  ) {
    this.#openai = openAI;
    this.#sandbox = sandbox;
    this.#loader = loader;

    // TODO check models exists
  }

  public static async create(
    baseUrl: string,
    apiKey: string | undefined,
    sandbox: ISandbox,
    loader: Loader,
  ): Promise<OpenAIRunnerFactory> {
    const openai = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });

    // Check for model availability
    try {
      await openai.models.retrieve(sandbox.manifest.model);
    } catch (e) {
      // TODO handle specific error for connections, like with ollama
      throw e;
    }

    if (sandbox.manifest.embeddingsModel) {
      await openai.models.retrieve(sandbox.manifest.embeddingsModel);
    }

    return new OpenAIRunnerFactory(
      openai,
      sandbox,
      loader,
    );
  }

  async runEmbedding(input: string | string[]): Promise<number[]> {
    const res = await this.#openai.embeddings.create({
      model: this.#sandbox.manifest.embeddingsModel ??
        "text-similarity-davinci-001",
      input,
    });

    return res.data[0].embedding;
  }

  @Memoize()
  public async getContext(): Promise<IContext> {
    if (!this.#sandbox.manifest.vectorStorage) {
      return new Context(this.runEmbedding);
    }

    const { type } = this.#sandbox.manifest.vectorStorage;
    if (type !== "lancedb") {
      throw new Error("Only lancedb vector storage is supported");
    }

    const loadRes = await this.#loader.getVectorDb();
    if (!loadRes) throw new Error("Failed to load vector db");
    const connection = await lancedb.connect(fromFileUrlSafe(loadRes[0]));

    return new Context(this.runEmbedding, connection);
  }

  public async getRunner(chatStorage: IChatStorage): Promise<OpenAIRunner> {
    return new OpenAIRunner(
      this.#openai,
      await this.getContext(),
      this.#sandbox,
      chatStorage,
    );
  }
}

export class OpenAIRunner implements IRunner {
  #openai: OpenAI;
  #context: IContext;

  constructor(
    openAI: OpenAI,
    context: IContext,
    private sandbox: ISandbox,
    private chatStorage: IChatStorage,
  ) {
    this.#openai = openAI;
    this.#context = context;
  }

  async prompt(message: string): Promise<string> {
    const outMessage = await this.promptMessages([{
      role: "user",
      content: message,
    }]);
    return outMessage.message.content;
  }

  async promptMessages(messages: Message[]): Promise<ChatResponse> {
    await this.chatStorage.append(messages);
    const tmpMessages = await this.chatStorage.getHistory();

    const completion = await this.runChat(tmpMessages);

    const choise = completion.choises[0];
    return {
      model: completion.model,
      created_at: new Date(completion.created * 1000),
      message: choise.message.content,
      done: true,
      done_reason: choise.finish_reason, // TODO map to correct message
      total_duration: 0,
      load_duration: 0,
      prompt_eval_count: completion.usage.prompt_tokens,
      prompt_eval_duration: 0,
      eval_count: completion.usage.eval_count,
      eval_duration: 0,
    };
  }

  private async runChat(messages: Message[]): Promise<ParsedChatCompletion> {
    const tools = await this.sandbox.getTools();

    const runner = await this.#openai.beta.chat.completions.runTools({
      model: this.sandbox.manifest.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      } satisfies ChatCompletionMessageParam)),
      tools: tools.map((t) => {
        if (t.type !== "function") {
          throw new Error("expected function tool type");
        }
        return {
          type: "function",
          function: {
            ...t.function,
            function: (args: unknown) =>
              this.sandbox.runTool(t.function.name, args, this.#context),
          },
        };
      }),
    });

    return await runner.finalChatCompletion();
  }
}
