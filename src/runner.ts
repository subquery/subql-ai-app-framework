import type { ChatResponse, Message, Ollama } from "ollama";
import type { IChatStorage } from "./chatStorage/index.ts";
import type { ISandbox } from "./sandbox/index.ts";
import type { IContext } from "./context/context.ts";

export class Runner {
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
            return await this.sandbox.runTool(
              toolCall.function.name,
              toolCall.function.arguments,
              this.#context,
            );
          } catch (e: unknown) {
            console.error(`Tool call failed: ${e}`);
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
