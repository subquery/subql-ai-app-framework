import ollama from "ollama";
import * as lancedb from '@lancedb/lancedb';

// import {SubqlEmbeddingFunction} from './embeddings/embeddingFunction';


export class LanceStorage {

  private constructor(private dbTable: lancedb.Table, readonly model: string) {

  }

  public static async create(dbPath: string, tableName: string, model = 'nomic-embed-text'): Promise<LanceStorage> {
    const db = await lancedb.connect(dbPath);

    // const func = new SubqlEmbeddingFunction(ollama, model);


    const table = await db.openTable(tableName, {
      // embeddingFunction: {
      //   function: func,
      //   sourceColumn: 'content',
      //   vectorColumn: 'vector',
      // },
    });

    return new LanceStorage(table, model);
  }

  async search(input: string): Promise<string[]> {
    console.log('Embeddings for', input);
    const { embeddings: [embedding] } = await ollama.embed({
      model: this.model,
      input: input,
    });

    console.log('RUnning vector search')

    // const res1 = await this.dbTable.search(input)
    //   .limit(10)
    //   .toArray();

    // console.log('res1', res1.map(r => r.content));

    const res = await this.dbTable.vectorSearch(embedding)
      .limit(10)
      .toArray();

    return res.map(r => r.content);
  }
}
