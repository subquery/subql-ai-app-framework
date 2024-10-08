import {
  type BaseEmbeddingSource,
  MarkdownEmbeddingSource,
} from "./mdSource.ts";
import { walk } from "@std/fs/walk";
import ollama from "ollama";
import { LanceWriter } from "../lance/index.ts";

const DEFAULT_IGNORED_FILES = ["pages/404.mdx"];

export async function generate(
  path: string,
  lanceDbPath: string,
  tableName: string,
  ignoredFiles = DEFAULT_IGNORED_FILES,
) {
  const embeddingSources: BaseEmbeddingSource[] = [
    ...(await Array.fromAsync(walk(path)))
      .filter(({ path }) => /\.mdx?$/.test(path))
      .filter(({ path }) => !ignoredFiles.includes(path))
      .map((entry) => new MarkdownEmbeddingSource("guide", entry.path)),
  ];

  console.log(`Discovered ${embeddingSources.length} pages`);

  const lanceWriter = await LanceWriter.createNewTable(
    lanceDbPath,
    tableName,
    ollama,
  );

  for (const source of embeddingSources) {
    try {
      const { sections } = await source.load();

      for (const { content } of sections) {
        // OpenAI recommends replacing newlines with spaces for best results (specific to embeddings)
        const input = content.replace(/\n/g, " ");

        lanceWriter.write(input);
      }
    } catch (e) {
      console.warn(`Failed to process ${source.path}`, e);
      // throw e;
    }
  }

  lanceWriter.close();
}

// generate(
//   path.resolve('/Users/scotttwiname/Projects/subql-docs/docs'),
//   path.resolve(__dirname, '../../.db'),
//   'subql-docs'
// );
