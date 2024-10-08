import { type Static, Type } from "@sinclair/typebox";
import type { Ollama } from "ollama";
import type { Connection } from "@lancedb/lancedb";

export const ContextType = Type.Object({
  vectorSearch: Type.Function(
    [
      Type.String({ description: "The table of the query" }),
      Type.Array(Type.Number(), {
        description: "The embedded vector result from `computeQueryEmbedding`",
      }),
    ],
    Type.Promise(Type.Array(Type.Any())),
    {
      description: "Perform a vector search on the db",
    },
  ),

  computeQueryEmbedding: Type.Function(
    [
      Type.String({ description: "The search query" }),
    ],
    Type.Promise(Type.Array(Type.Number())),
    { description: "Generate vector embeddings from an input" },
  ),
});

export type IContext = Static<typeof ContextType>;

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

  async computeQueryEmbedding(query: string): Promise<number[]> {
    const { embeddings: [embedding] } = await this.#model.embed({
      model: this.embedModel,
      input: query,
    });

    return embedding;
  }
}
