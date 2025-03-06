import { type BaseEmbeddingSource, MarkdownEmbeddingSource } from "./source.ts";
import { glob } from "glob";
import {
  type GenerateEmbedding,
  LanceWriter,
} from "../../storage/lance/index.ts";
import { getLogger } from "../../../logger.ts";
import { getSpinner } from "../../../util.ts";
import {
  type Document,
  EmbeddingsWriter,
} from "../../storage/embeddingsWriter.ts";

const DEFAULT_IGNORED_PATHS = [
  "/**/pages/404.mdx",
  "/**/node_modules/**",
  "/**/.yarn/**",
];

const logger = await getLogger("MDEmbeddingsGenerator");

export async function generateToTable(
  path: string,
  lanceDbPath: string,
  tableName: string,
  generateEmbedding: GenerateEmbedding,
  dimensions: number,
  ignoredPaths = DEFAULT_IGNORED_PATHS,
  overwrite = false,
  collectionName?: string,
) {
  const lanceWriter = await LanceWriter.createNewTable(
    lanceDbPath,
    tableName,
    dimensions,
    overwrite,
  );

  try {
    const embeddingsWriter = new EmbeddingsWriter(
      lanceWriter,
      generateEmbedding,
    );

    logger.info(`Dimensions: ${dimensions}`);

    return await generate(path, embeddingsWriter, ignoredPaths, collectionName);
  } finally {
    lanceWriter.close();
  }
}

export async function generate(
  path: string,
  writer: EmbeddingsWriter,
  ignoredPaths = DEFAULT_IGNORED_PATHS,
  collectionName?: string,
) {
  const embeddingSources: BaseEmbeddingSource[] =
    (await glob([`${path}/**/*.{md,mdx}`], { ignore: ignoredPaths }))
      .map((path) => new MarkdownEmbeddingSource("guide", path));

  logger.debug(
    `Source files: ${embeddingSources.map((s) => s.path).join("\n")}`,
  );

  logger.info(`Discovered ${embeddingSources.length} pages`);

  const spinner = getSpinner().start(
    `Processing files (0/${embeddingSources.length})`,
  );

  const parsingErrors: { error: unknown; source: BaseEmbeddingSource }[] = [];
  const contentGenerator = async function* processSources(): AsyncGenerator<
    Document
  > {
    for (const [idx, source] of embeddingSources.entries()) {
      try {
        spinner.text = `Processing files (${
          idx + 1
        }/${embeddingSources.length})`;
        const { sections, checksum } = await source.load();
        const chunks = sections.map(({ content, slug }) => ({
          content: content.replace(/\n/g, " "),
          uri: buildFileUri(source.path, slug),
        }));
        yield { contentHash: checksum, chunks };
      } catch (e) {
        parsingErrors.push({ error: e, source });
      }
    }
  };

  const errors = await writer.writeCollection(
    collectionName ?? path,
    contentGenerator,
  );

  if (errors.length || parsingErrors.length) {
    spinner.warn(`Processed all files with errors:
${
      parsingErrors.map(({ source, error }) => `\t${source.path}: ${error}`)
        .join("\n")
    }
${
      errors.map(({ document, error }) =>
        `\t${document?.chunks[0].uri ?? "Unknown Document"}: ${error}`
      )
        .join("\n")
    }`);
  } else {
    spinner.succeed("Successfully processed all files");
  }
}

function buildFileUri(fileName: string, slug?: string): string {
  const url = new URL(`file://${fileName}`);
  if (slug) {
    url.hash = slug;
  }
  return url.toString();
}
