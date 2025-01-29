import { getLogger } from "../../logger.ts";
import { getSpinner } from "../../util.ts";
import { type GenerateEmbedding, LanceWriter } from "../lance/index.ts";
import { crawlWebSource, type Scope } from "./webSource.ts";

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
    generateEmbedding,
    dimensions,
    overwrite,
  );

  const spinner = getSpinner().start(
    `Crawling ${url}`,
  );

  for await (const result of crawlWebSource(url, scope)) {
    spinner.text = `Fetched ${result.url}, processing`;

    for (const text of result.data.text) {
      // OpenAI recommends replacing newlines with spaces for best results (specific to embeddings)
      const input = text.replace(/\n/g, " ");
      await lanceWriter.write(input);
    }
  }

  await lanceWriter.close();
  spinner.succeed(`Crawled ${url}`);
}
