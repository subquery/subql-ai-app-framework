import { getLogger } from "../../../logger.ts";
import { getSpinner } from "../../../util.ts";
import { EmbeddingsWriter } from "../../storage/embeddingsWriter.ts";
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
    // generateEmbedding,
    dimensions,
    overwrite,
  );

  const writer = new EmbeddingsWriter(lanceWriter, generateEmbedding);

  const spinner = getSpinner().start(
    `Crawling ${url}`,
  );

  for await (const result of crawlWebSource(url, scope)) {
    spinner.text = `Fetched ${result.url}, processing`;

    const pageData = result.data.text.map((text) => ({
      content: text.replace(/\n/g, " "),
      uri: result.url,
      contentHash: result.data.contentHash,
    }));

    await writer.writeDocument(pageData);
  }

  await lanceWriter.close();
  spinner.succeed(`Crawled ${url}`);
}
