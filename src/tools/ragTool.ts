import type { IContext } from "../context/types.ts";
import { FunctionTool } from "./tool.ts";

export class RagTool extends FunctionTool {
  /**
   * RagTool is a default implementation allowing querying RAG data
   * @param tableName The name of the table to query
   * @param column The column on the table to extract results from
   */
  constructor(
    readonly tableName: string,
    readonly column: string,
  ) {
    super();
  }

  get description(): string {
    return `This tool gets relevant information from the ${this.tableName}. It returns a list of results separated by newlines.`;
  }

  parameters = {
    type: "object",
    required: ["query"],
    properties: {
      query: {
        type: "string",
        description: "A search string, generally the users prompt",
      },
    },
  };

  async call({ query }: { query: string }, ctx: IContext): Promise<string> {
    const vector = await ctx.computeQueryEmbedding(query);
    const raw = await ctx.vectorSearch(this.tableName, vector);

    const res = raw.map((r) => r[this.column])
      .filter((c) => !!c)
      .join("\n");

    return res;
  }
}
