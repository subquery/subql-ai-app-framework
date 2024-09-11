import { IFunctionTool } from "../tool";
import { ISandbox } from "./sandbox";


export class MockSandbox implements ISandbox {

  constructor(private tools: IFunctionTool[]) {

  }

  async getTools() {
    return this.tools.map(t => t.toTool());
  }

  async runTool(toolName: string, args: any): Promise<any> {
    const tool = this.tools.find(t => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return tool.call(args);
  }
}
