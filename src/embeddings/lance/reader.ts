
import * as lancedb from "@lancedb/lancedb";
import { IEmbeddingReader } from "../embeddings";
import ollama, { Ollama } from "ollama";

export class LanceReader implements IEmbeddingReader {

  #table: lancedb.Table;
  #model: Ollama;
  #embedModel: string;

  constructor(table: lancedb.Table, model: Ollama, embedModel = 'nomic-embed-text', readonly topK = 10) {
    this.#table = table;
    this.#model = model;
    this.#embedModel = embedModel;
  }

  static async open(dbPath: string, tableName: string, model: Ollama = ollama, embedModel = 'nomic-embed-text', topK = 10): Promise<LanceReader> {
    const db = await lancedb.connect(dbPath);

    const table = await db.openTable(tableName);

    return new LanceReader(table, model, embedModel, topK);
  }

  async search(query: string): Promise<string[]> {
    const { embeddings: [embedding] } = await this.#model.embed({
      model: this.#embedModel,
      input: query,
    });

    const res = await this.#table.vectorSearch(embedding)
      .limit(this.topK)
      .toArray()

    // This is the "content" colum, see the writer for the schema
    return res.map(r => r.content);
  }
}
