import { type ChatResponse, type Message, Ollama } from "ollama";
import type { IChatStorage } from "../chatStorage/chatStorage.ts";
import type { ISandbox } from "../sandbox/index.ts";
import type { IContext } from "../context/types.ts";
import { getLogger } from "../logger.ts";
import { LogPerformance, Memoize } from "../decorators.ts";
import type { IRunner, IRunnerFactory } from "./runner.ts";
import type { Loader } from "../loader.ts";
import { Context } from "../context/context.ts";

const logger = await getLogger("runner:ollama");

export class OllamaRunnerFactory implements IRunnerFactory {
  #ollama: Ollama;
  #sandbox: ISandbox;
  #loader: Loader;

  private constructor(
    ollama: Ollama,
    sandbox: ISandbox,
    loader: Loader,
  ) {
    this.#ollama = ollama;
    this.#sandbox = sandbox;
    this.#loader = loader;
  }

  public static async create(
    host: string,
    sandbox: ISandbox,
    loader: Loader,
  ) {
    const ollama = new Ollama({ host });

    // Check that Ollama can be reached and the models exist
    try {
      await ollama.show({ model: sandbox.manifest.model });
    } catch (e) {
      if (e instanceof TypeError && e.message.includes("Connection refused")) {
        throw new Error(
          "Unable to reach Ollama, please check your `host` option.",
          { cause: e },
        );
      }
      throw e;
    }

    if (sandbox.manifest.embeddingsModel) {
      await ollama.show({ model: sandbox.manifest.embeddingsModel });
    }

    const factory = new OllamaRunnerFactory(ollama, sandbox, loader);

    // Makes sure vectorStorage is loaded
    await factory.getContext();

    return factory;
  }

  async runEmbedding(input: string): Promise<number[]> {
    const { embeddings: [embed] } = await this.#ollama.embed({
      model: this.#sandbox.manifest.embeddingsModel ?? "nomic-embed-text",
      input,
    });

    return embed;
  }

  @Memoize()
  private getContext(): Promise<IContext> {
    return Context.create(
      this.#sandbox,
      this.#loader,
      this.runEmbedding.bind(this),
    );
  }

  public async getRunner(chatStorage: IChatStorage): Promise<IRunner> {
    return new OllamaRunner(
      this.#sandbox,
      chatStorage,
      this.#ollama,
      await this.getContext(),
    );
  }
}

export class OllamaRunner implements IRunner {
  #ollama: Ollama;
  #context: IContext;

  constructor(
    private sandbox: ISandbox,
    private chatStorage: IChatStorage,
    ollama: Ollama,
    context: IContext,
  ) {
    this.#ollama = ollama;
    this.#context = context;
  }

  @LogPerformance(logger)
  private async runChat(messages: Message[]): Promise<ChatResponse> {
    const res = await this.#ollama.chat({
      model: this.sandbox.manifest.model,
      stream: false,
      tools: await this.sandbox.getTools(),
      // TODO should there be a limit to the number of items in the chat history?
      messages,
    });
    return res;
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

    return await this.scopedPrompt(tmpMessages);
  }

  private async scopedPrompt(messages: Message[]): Promise<ChatResponse> {
    // Tmp messages include the message history + any internal messages from tools
    const tmpMessages = [...messages];
    while (true) {
      const res = await this.runChat(tmpMessages);

      // Add to the chat history
      tmpMessages.push(res.message);

      // No more tools to work with return the result
      if (!res.message.tool_calls?.length) {
        this.chatStorage.append([res.message]);
        return res;
      }

      // Run tools and use their responses
      const toolResponses = await Promise.all(
        (res.message.tool_calls ?? []).map(async (toolCall) => {
          try {
            logger.debug(
              `Calling tool: "${toolCall.function.name}" args: "${
                JSON.stringify(toolCall.function.arguments)
              }`,
            );
            return await this.sandbox.runTool(
              toolCall.function.name,
              toolCall.function.arguments,
              this.#context,
            );
          } catch (e: unknown) {
            logger.error(`Tool call failed: ${e}`);
            // Don't throw the error this will exit the application, instead pass the message back to the LLM
            return (e as Error).message;
          }
        }),
      );

      tmpMessages.push(
        ...toolResponses.map((m) => ({ role: "tool", content: m })),
      );
    }
  }

  async getHistory(includeInternal = false): Promise<Message[]> {
    const fullHistory = await this.chatStorage.getHistory();

    if (includeInternal) {
      return fullHistory;
    }

    return fullHistory.filter((m) => m.role !== "tool" && m.role !== "system");
  }
}
