import type { Connection } from "@lancedb/lancedb";
import { LogPerformance } from "../decorators.ts";
import { getLogger } from "../logger.ts";
import type { IContext } from "./types.ts";
import type { ISandbox } from "../sandbox/sandbox.ts";
import type { Loader } from "../loader.ts";
import { fromFileUrlSafe } from "../util.ts";
import * as lancedb from "@lancedb/lancedb";

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

  public static async create(
    sandbox: ISandbox,
    loader: Loader,
    runEmbedding: GetEmbedding,
  ): Promise<Context> {
    if (!sandbox.manifest.vectorStorage) {
      return new Context(runEmbedding);
    }

    const { type } = sandbox.manifest.vectorStorage;
    if (type !== "lancedb") {
      throw new Error("Only lancedb vector storage is supported");
    }

    const loadRes = await loader.getVectorDb();
    if (!loadRes) throw new Error("Failed to load vector db");
    const connection = await lancedb.connect(fromFileUrlSafe(loadRes[0]));

    return new Context(runEmbedding, connection);
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
