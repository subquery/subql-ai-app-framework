import type { ChatResponse, Message } from "ollama";
import type { IRunner, IRunnerFactory } from "./runner.ts";
import OpenAI from "openai";
import type { IChatStorage } from "../chatStorage/chatStorage.ts";
import type { ISandbox } from "../sandbox/sandbox.ts";
import type { IContext } from "../context/types.ts";
import { LogPerformance, Memoize } from "../decorators.ts";
import type { Loader } from "../loader.ts";
import { Context } from "../context/context.ts";
import { getLogger } from "../logger.ts";

const logger = await getLogger("runner:openai");

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
  }

  public static async create(
    baseUrl: string | undefined,
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
      // The same 404 error is returned if the baseUrl or the model is not found
      if (e instanceof OpenAI.NotFoundError) {
        throw new Error(`Model ${sandbox.manifest.model} not found`);
      }
      throw e;
    }

    if (sandbox.manifest.embeddingsModel) {
      await openai.models.retrieve(sandbox.manifest.embeddingsModel);
    }

    const factory = new OpenAIRunnerFactory(
      openai,
      sandbox,
      loader,
    );

    // Makes sure vector storage is loaded
    await factory.getContext();

    return factory;
  }

  async runEmbedding(input: string | string[]): Promise<number[]> {
    const res = await this.#openai.embeddings.create({
      model: this.#sandbox.manifest.embeddingsModel ??
        "text-embedding-3-small",
      input,
    });

    return res.data[0].embedding;
  }

  @Memoize()
  private getContext(): Promise<IContext> {
    return Context.create(
      this.#sandbox,
      this.#loader,
      this.runEmbedding.bind(this),
    );
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

    return this.runChat(tmpMessages);
  }

  @LogPerformance(logger)
  private async runChat(messages: Message[]): Promise<ChatResponse> {
    const tools = await this.sandbox.getTools();

    const runner = this.#openai.beta.chat.completions.runTools({
      model: this.sandbox.manifest.model,
      messages: messages.map((m) => ({
        role: m.role as "user" | "system" | "assistant",
        content: m.content,
      })),
      tools: tools.map((t) => {
        if (t.type !== "function") {
          throw new Error("expected function tool type");
        }
        return {
          type: "function",
          function: {
            ...t.function,
            function: async (args: unknown) => {
              try {
                logger.debug(
                  `Calling tool: "${t.function.name}" args: "${
                    JSON.stringify(args)
                  }`,
                );
                return await this.sandbox.runTool(
                  t.function.name,
                  args,
                  this.#context,
                );
              } catch (e: unknown) {
                logger.error(`Tool call failed: ${e}`);
                // Don't throw the error this will exit the application, instead pass the message back to the LLM
                return (e as Error).message;
              }
            },
          },
        };
      }),
    });

    const completion = await runner.finalChatCompletion();

    // Convert respons to Ollama ChatResponse
    const choice = completion.choices[0];
    const res: ChatResponse = {
      model: completion.model,
      created_at: new Date(completion.created * 1000),
      message: {
        content: choice.message.content ?? "",
        role: choice.message.role,
      },
      done: true,
      done_reason: choice.finish_reason,
      total_duration: 0,
      load_duration: 0,
      prompt_eval_count: completion.usage?.prompt_tokens ?? 0,
      prompt_eval_duration: 0,
      eval_count: completion.usage?.completion_tokens ?? 0,
      eval_duration: 0,
    };

    return res;
  }
}
