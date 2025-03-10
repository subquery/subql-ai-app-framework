import {
  type BaseEmbeddingSource,
  MarkdownEmbeddingSource,
} from "./mdSource.ts";
import { glob } from "glob";
import { type GenerateEmbedding, LanceWriter } from "../lance/index.ts";
import { getLogger } from "../../logger.ts";
import { getSpinner } from "../../util.ts";

const DEFAULT_IGNORED_PATHS = [
  "/**/pages/404.mdx",
  "/**/node_modules/**",
  "/**/.yarn/**",
];

const logger = await getLogger("MDEmbeddingsGenerator");

export async function generate(
  path: string,
  lanceDbPath: string,
  tableName: string,
  generateEmbedding: GenerateEmbedding,
  dimensions: number,
  ignoredPaths = DEFAULT_IGNORED_PATHS,
  overwrite = false,
) {
  const embeddingSources: BaseEmbeddingSource[] =
    (await glob([`${path}/**/*.{md,mdx}`], { ignore: ignoredPaths }))
      .map((path) => new MarkdownEmbeddingSource("guide", path));

  logger.info(`Dimensions: ${dimensions}`);

  logger.debug(
    `Source files: ${embeddingSources.map((s) => s.path).join("\n")}`,
  );

  logger.info(`Discovered ${embeddingSources.length} pages`);

  const lanceWriter = await LanceWriter.createNewTable(
    lanceDbPath,
    tableName,
    generateEmbedding,
    dimensions,
    overwrite,
  );

  const spinner = getSpinner().start(
    `Processing files (0/${embeddingSources.length})`,
  );

  const errors: { error: Error; source: BaseEmbeddingSource }[] = [];

  for (const [idx, source] of embeddingSources.entries()) {
    try {
      spinner.text = `Processing files (${idx + 1}/${embeddingSources.length})`;
      const { sections } = await source.load();

      for (const { content } of sections) {
        // OpenAI recommends replacing newlines with spaces for best results (specific to embeddings)
        const input = content.replace(/\n/g, " ");

        await lanceWriter.write(input);
      }
    } catch (e) {
      errors.push({ error: e as Error, source });
    }
  }

  await lanceWriter.close();
  if (errors.length) {
    spinner.warn(`Processed all files with errors:
${
      errors.map(({ source, error }) => `\t${source.path}: ${error.message}`)
        .join("\n")
    }`);
  } else {
    spinner.succeed("Successfully processed all files");
  }
}
