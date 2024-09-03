import ollama from "ollama";
import * as lancedb from '@lancedb/lancedb';



export class LanceStorage {

  private constructor(private dbTable: lancedb.Table, readonly model: string) {

  }

  public static async create(dbPath: string, tableName: string, model = 'nomic-embed-text'): Promise<LanceStorage> {
    const db = await lancedb.connect(dbPath);

    const table = await db.openTable(tableName);

    return new LanceStorage(table, model);
  }

  async search(input: string): Promise<string[]> {
    const { embeddings } = await ollama.embed({
      model: this.model,
      input,
    });

    const res = await this.dbTable.vectorSearch(embeddings[0]).toArray();

    return res.map(r => r.pageContent);
  }
}
