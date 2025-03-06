import { getLogger } from "../../../logger.ts";
import { getSpinner } from "../../../util.ts";
import {
  type Document,
  EmbeddingsWriter,
} from "../../storage/embeddingsWriter.ts";
import {
  type GenerateEmbedding,
  LanceWriter,
} from "../../storage/lance/index.ts";
import { crawlWebSource, type Scope } from "./source.ts";

const logger = await getLogger("WebEmbeddingsGenerator");

export async function generate(
  url: string,
  lanceDbPath: string,
  tableName: string,
  generateEmbedding: GenerateEmbedding,
  dimensions: number,
  scope: Scope = "domain",
  overwrite = false,
  collectionName?: string,
) {
  logger.info(`Dimensions: ${dimensions}`);

  try {
    new URL(url);
  } catch (_e) {
    throw new Error(`${url} is not a valid url`);
  }

  const lanceWriter = await LanceWriter.createNewTable(
    lanceDbPath,
    tableName,
    dimensions,
    overwrite,
  );

  const writer = new EmbeddingsWriter(lanceWriter, generateEmbedding);

  const spinner = getSpinner().start(
    `Crawling ${url}`,
  );

  const contentGenerator = async function* processWebSources(): AsyncGenerator<
    Document
  > {
    for await (const result of crawlWebSource(url, scope)) {
      yield {
        contentHash: result.data.contentHash,
        chunks: result.data.text.map((text) => ({
          content: text.replace(/\n/g, " "),
          uri: result.url,
        })),
      };
    }
  };

  await writer.writeCollection(collectionName ?? url, contentGenerator);

  await lanceWriter.close();
  spinner.succeed(`Crawled ${url}`);
}
