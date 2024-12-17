import * as lancedb from "@lancedb/lancedb";
import { Field, FixedSizeList, Float64, Schema, Utf8 } from "apache-arrow";
import type { IEmbeddingWriter } from "../embeddings.ts";

export type GenerateEmbedding = (
  input: string | string[],
  dimensions?: number,
) => Promise<number[][]>;

export class LanceWriter implements IEmbeddingWriter {
  #table: lancedb.Table;
  #generateEmbedding: GenerateEmbedding;
  #dimensions: number;

  constructor(
    table: lancedb.Table,
    generateEmbedding: GenerateEmbedding,
    dimensions: number,
  ) {
    this.#table = table;
    this.#generateEmbedding = generateEmbedding;
    this.#dimensions = dimensions;
  }

  static async createNewTable(
    dbPath: string,
    tableName: string,
    generateEmbedding: GenerateEmbedding,
    dimensions: number,
    overwrite = false,
  ): Promise<LanceWriter> {
    const db = await lancedb.connect(dbPath);

    const schema = new Schema([
      new Field("content", new Utf8()),
      new Field(
        "vector",
        new FixedSizeList(dimensions, new Field("item", new Float64(), true)),
        false,
      ),
    ]);

    const table = await db.createEmptyTable(
      tableName,
      schema,
      { mode: overwrite ? "overwrite" : "create" },
    );

    return new LanceWriter(table, generateEmbedding, dimensions);
  }

  async write(input: string | string[]): Promise<void> {
    const embeddings = await this.#generateEmbedding(input, this.#dimensions);

    const inputArr = Array.isArray(input) ? input : [input];
    const data = inputArr.map((input, idx) => {
      return {
        content: input,
        vector: embeddings[idx],
      };
    });

    await this.#table.add(data);
  }

  // deno-lint-ignore require-await
  async close(): Promise<void> {
    return this.#table.close();
  }
}
