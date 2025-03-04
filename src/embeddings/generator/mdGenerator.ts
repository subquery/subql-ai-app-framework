import {
  type BaseEmbeddingSource,
  MarkdownEmbeddingSource,
} from "./mdSource.ts";
import { glob } from "glob";
import plimit from "npm:p-limit";
import { type GenerateEmbedding, LanceWriter } from "../lance/index.ts";
import { getLogger } from "../../logger.ts";
import { getSpinner } from "../../util.ts";

const DEFAULT_IGNORED_PATHS = [
  "/**/pages/404.mdx",
  "/**/node_modules/**",
  "/**/.yarn/**",
];

const logger = await getLogger("MDEmbeddingsGenerator");

const sourcePlimit = plimit(20);
const sectionPlimit = plimit(20);

export async function generate(
  path: string,
  lanceDbPath: string,
  tableName: string,
  generateEmbedding: GenerateEmbedding,
  dimensions: number,
  ignoredPaths = DEFAULT_IGNORED_PATHS,
  overwrite = false,
) {
  const embeddingSources: BaseEmbeddingSource[] = (
    await glob([`${path}/**/*.{md,mdx}`], { ignore: ignoredPaths })
  ).map((path) => new MarkdownEmbeddingSource("guide", path));

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

  const failedSourcesPath: string[] = [];

  let completedTasks = 0;
  spinner.text =
    `Processed files (${completedTasks}/${embeddingSources.length})`;

  const promises = embeddingSources.map((source) => {
    return sourcePlimit(async () => {
      try {
        const { sections } = await source.load();
        const sectionPromises = sections.map(({ content }) => {
          return sectionPlimit(async () => {
            // OpenAI recommends replacing newlines with spaces for best results (specific to embeddings)
            const input = content.replace(/\n/g, " ");

            await lanceWriter.write(input);
          });
        });

        const result = await Promise.allSettled(sectionPromises);
        if (result.some((r) => r.status === "rejected")) {
          throw new Error("Failed to process sections");
        }
        completedTasks += 1;
        spinner.text =
          `Processed files (${completedTasks}/${embeddingSources.length})`;
      } catch (e) {
        console.warn(`Failed to process ${source.path}`, e);
        failedSourcesPath.push(source.path);
      }
    });
  });

  await Promise.allSettled(promises);

  await lanceWriter.close();
  spinner.succeed(
    `Processed all files, successed: ${completedTasks}, failed: ${failedSourcesPath.length}${
      failedSourcesPath.length
        ? `\n , failed paths: ${failedSourcesPath.join("\n")}`
        : ""
    }`,
  );
}
