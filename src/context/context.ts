import type { Connection } from "@lancedb/lancedb";
import { LogPerformance } from "../decorators.ts";
import { getLogger } from "../logger.ts";
import type { IContext } from "./types.ts";

const logger = await getLogger("ToolContext");

type GetEmbedding = (input: string | string[]) => Promise<number[]>;

export class Context implements IContext {
  #getEmbedding: GetEmbedding;
  #vectorStorage?: Connection;

  constructor(
    getEmbedding: GetEmbedding,
    vectorStorage?: Connection,
    readonly topK = 10,
  ) {
    this.#getEmbedding = getEmbedding;
    this.#vectorStorage = vectorStorage;
  }

  @LogPerformance(logger)
  async vectorSearch(tableName: string, vector: number[]): Promise<unknown[]> {
    if (!this.#vectorStorage) {
      throw new Error(
        "Project did not provide vector storage. Unable to perform search",
      );
    }
    const table = await this.#vectorStorage.openTable(tableName);

    return await table.vectorSearch(vector)
      .limit(this.topK)
      .toArray();
  }

  @LogPerformance(logger)
  computeQueryEmbedding(query: string): Promise<number[]> {
    return this.#getEmbedding(query);
  }
}
