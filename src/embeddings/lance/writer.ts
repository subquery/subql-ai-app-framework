import * as lancedb from "@lancedb/lancedb";
import { Field, FixedSizeList, Float64, Schema, Utf8 } from "apache-arrow";
import type { IEmbeddingWriter } from "../embeddings.ts";

export type GenerateEmbedding = (
  input: string | string[],
) => Promise<number[][]>;

export class LanceWriter implements IEmbeddingWriter {
  #table: lancedb.Table;
  #generateEmbedding: GenerateEmbedding;

  static #dim = 768;

  static #schema = new Schema([
    new Field("content", new Utf8()),
    new Field(
      "vector",
      new FixedSizeList(this.#dim, new Field("item", new Float64(), true)),
      false,
    ),
  ]);

  constructor(
    table: lancedb.Table,
    generateEmbedding: GenerateEmbedding,
  ) {
    this.#table = table;
    this.#generateEmbedding = generateEmbedding;
  }

  static async createNewTable(
    dbPath: string,
    tableName: string,
    generateEmbedding: GenerateEmbedding,
    overwrite = false,
  ): Promise<LanceWriter> {
    const db = await lancedb.connect(dbPath);

    const table = await db.createEmptyTable(
      tableName,
      this.#schema,
      { mode: overwrite ? "overwrite" : "create" },
    );

    return new LanceWriter(table, generateEmbedding);
  }

  async write(input: string | string[]): Promise<void> {
    const embeddings = await this.#generateEmbedding(input);

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
