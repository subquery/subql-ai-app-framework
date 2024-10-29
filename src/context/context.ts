import type { Ollama } from "ollama";
import type { Connection } from "@lancedb/lancedb";
import { LogPerformance } from "../decorators.ts";
import { getLogger } from "../logger.ts";
import type { IContext } from "./types.ts";

const logger = await getLogger("ToolContext");

export class Context implements IContext {
  #model: Ollama;
  #vectorStorage?: Connection;

  constructor(
    model: Ollama,
    vectorStorage?: Connection,
    readonly embedModel = "nomic-embed-text",
    readonly topK = 10,
  ) {
    this.#model = model;
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
  async computeQueryEmbedding(query: string): Promise<number[]> {
    const { embeddings: [embedding] } = await this.#model.embed({
      model: this.embedModel,
      input: query,
    });

    return embedding;
  }
}
