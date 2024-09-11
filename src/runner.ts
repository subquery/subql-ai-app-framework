
import { Ollama, ChatResponse, Message } from 'ollama';
import { IChatStorage } from './chatStorage';
import { ISandbox } from './sandbox';

export class Runner {

  private ollama: Ollama;

  constructor(
    private model: string,
    private sandbox: ISandbox,
    private chatStorage: IChatStorage,
    private host ='http://127.0.0.1:11434',
  ) {
    this.ollama = new Ollama({ host: this.host });
  }

  private async runChat(): Promise<ChatResponse> {
    console.time('chat');

    const res = await this.ollama.chat({
      model: this.model,
      stream: false,
      tools: await this.sandbox.getTools(),
      // TODO should there be a limit to the number of items in the chat history?
      messages: await this.chatStorage.getHistory(),
    });
    console.timeEnd('chat');
    return res;
  }

  async prompt(message: string): Promise<string> {
    this.chatStorage.append([{ role: 'user', content: message }]);

    while(true) {
      const res = await this.runChat();

      // Add to the chat history
      this.chatStorage.append([res.message]);

      // No more tools to work with return the result
      if (!res.message.tool_calls?.length) {
        return res.message.content;
      }

      // Run tools and use their responses
      const toolResponses = await Promise.all((res.message.tool_calls ?? []).map(async (toolCall) => {
        return this.sandbox.runTool(toolCall.function.name, toolCall.function.arguments)
      }));

      this.chatStorage.append(toolResponses.map(m => ({ role: 'tool', content: m })));
    }
  }

  async getHistory(includeInternal = false): Promise<Message[]> {
    const fullHistory = await this.chatStorage.getHistory();

    if (includeInternal) {
      return fullHistory;
    }

    return fullHistory.filter(m => m.role !== 'tool' && m.role !== 'system');
  }
}
