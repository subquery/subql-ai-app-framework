import * as lancedb from "@lancedb/lancedb";
import { Field, FixedSizeList, Float64, Schema, Utf8 } from "apache-arrow";
import type { IEmbeddingWriter } from "../embeddings.ts";
import ollama, { type Ollama } from "ollama";

export class LanceWriter implements IEmbeddingWriter {
  #table: lancedb.Table;
  #model: Ollama;
  #embedModel: string;

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
    model: Ollama,
    embedModel = "nomic-embed-text",
  ) {
    this.#table = table;
    this.#model = model;
    this.#embedModel = embedModel;
  }

  static async createNewTable(
    dbPath: string,
    tableName: string,
    model: Ollama = ollama,
    embedModel = "nomic-embed-text",
  ): Promise<LanceWriter> {
    const db = await lancedb.connect(dbPath);

    const table = await db.createEmptyTable(tableName, this.#schema);

    return new LanceWriter(table, model, embedModel);
  }

  async write(input: string | string[]): Promise<void> {
    const { embeddings } = await this.#model.embed({
      model: this.#embedModel,
      input,
    });

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
