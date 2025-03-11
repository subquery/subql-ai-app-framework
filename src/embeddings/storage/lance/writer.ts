import * as lancedb from "@lancedb/lancedb";
import { Field, FixedSizeList, Float64, Schema, Utf8 } from "apache-arrow";
import type { EmbeddingSchema, IEmbeddingStorage } from "../../embeddings.ts";
import { getLogger } from "../../../logger.ts";

const logger = await getLogger("LanceWriter");

export type GenerateEmbedding = (
  input: string | string[],
  dimensions?: number,
) => Promise<number[][]>;

export class LanceWriter implements IEmbeddingStorage {
  #table: lancedb.Table;

  constructor(
    table: lancedb.Table,
  ) {
    this.#table = table;
  }

  static async createNewTable(
    dbPath: string,
    tableName: string,
    dimensions: number,
    overwrite = false,
  ): Promise<LanceWriter> {
    const db = await lancedb.connect(dbPath);

    // TODO store metadata with the llm embedding model
    const schema = new Schema([
      // new Field("id", new Int64()), // Lance DB has no concept of IDs or primary keys
      new Field("content", new Utf8(), false),
      new Field(
        "vector",
        new FixedSizeList(dimensions, new Field("item", new Float64(), false)),
        false,
      ),
      new Field("uri", new Utf8(), false),
      new Field("content_hash", new Utf8(), false),
      new Field("collection", new Utf8()),
    ]);

    // Updating table
    const tableNames = await db.tableNames();
    if (tableNames.includes(tableName) && !overwrite) {
      const existing = await db.openTable(tableName);
      const existingSchema = await existing.schema();

      if (!schemasEqual(schema, existingSchema)) {
        throw new Error(
          `Table "${tableName}" already exists with a different schema`,
        );
      }

      // TODO check indexes
      logger.info("Using existing table", tableName);
      return new LanceWriter(existing);
    }

    // New or overwritting table
    logger.info("Creating new table", tableName);
    const table = await db.createEmptyTable(
      tableName,
      schema,
      { mode: overwrite ? "overwrite" : "create" },
    );

    // TODO, currently throws an error, might need some data to be inserted first
    // // Content hash queries are used to see if the document already exists
    // await table.createIndex("content_hash");
    // // Content queries are used to get existing vector data
    // await table.createIndex("content");

    return new LanceWriter(table);
  }

  async write(input: EmbeddingSchema[]): Promise<void> {
    await this.#table.add(input.map((i) => this.toSchema(i)));
  }

  // Checks if there is data from a document with matching contentHash
  async hasContent(contentHash: string): Promise<boolean> {
    const count = await this.#table.countRows(
      `content_hash = "${contentHash}"`,
    );
    return count > 0;
  }

  // Removes all the content of a document with matching contentHash
  async removeContent(contentHash: string): Promise<void> {
    await this.#table.delete(`content_hash = "${contentHash}"`);
  }

  async pruneCollection(
    collection: string,
    remainingContentHashes: string[],
  ): Promise<void> {
    const contentHashes = remainingContentHashes.map((h) => `"${h}"`).join(
      ", ",
    );
    await this.#table.delete(
      `collection = "${collection}" AND content_hash NOT IN (${contentHashes})`,
    );
  }

  // Gets an item by its content, this is used as a cache for the vector data
  async getItem(content: string): Promise<EmbeddingSchema | undefined> {
    // TODO LanceDB offers no way to escape content. https://github.com/lancedb/lancedb/issues/1368
    try {
      const res = await this.#table.query()
        .where(`content = "${content}"`)
        .limit(1)
        .toArray();

      return res[0] && this.fromSchema(res[0]);
    } catch (e) {
      logger.error("Failed to get item", e);
      return undefined;
    }
  }

  async close(): Promise<void> {
    await this.#table.optimize();

    return this.#table.close();
  }

  search(/* query: string */): Promise<EmbeddingSchema[]> {
    throw new Error("Method not implemented.");
  }

  // Converts fields to snake_case to work with LanceDB
  private toSchema(input: EmbeddingSchema): Record<string, unknown> {
    const { contentHash, ...rest } = input;
    return {
      ...rest,
      content_hash: contentHash,
    };
  }

  // Converts fields to camelCase to work with LanceDB
  private fromSchema(input: Record<string, unknown>): EmbeddingSchema {
    const { content_hash, ...rest } = input;
    return {
      ...rest,
      contentHash: content_hash as string,
    } as EmbeddingSchema;
  }
}

function schemasEqual(a: Schema, b: Schema): boolean {
  if (a.fields.length !== b.fields.length) return false;

  for (let i = 0; i < a.fields.length; i++) {
    const fieldA = a.fields[i];
    const fieldB = b.fields[i];

    if (!fieldsEqual(fieldA, fieldB)) {
      return false;
    }
  }

  return true;
}

function fieldsEqual(a: Field, b: Field): boolean {
  if (a.name !== b.name) return false;
  if (a.type.typeId !== b.type.typeId) return false;
  if (a.type.children && b.type.children) {
    return fieldsEqual(a.type.children[0], b.type.children[0]);
  }

  return true;
}
