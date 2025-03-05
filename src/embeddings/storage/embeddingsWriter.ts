import { getLogger } from "../../logger.ts";
import type { EmbeddingSchema, IEmbeddingStorage } from "../embeddings.ts";
import type { GenerateEmbedding } from "./lance/writer.ts";

const logger = await getLogger("EmbeddingsWriter");

export class EmbeddingsWriter {
  #generateEmbedding: GenerateEmbedding;

  constructor(
    public readonly writer: IEmbeddingStorage,
    generateEmbedding: GenerateEmbedding,
  ) {
    this.#generateEmbedding = generateEmbedding;
  }

  // Write all the chunks of a document, this should include all the content chunks for a document with the same content hash
  async writeDocument(input: Omit<EmbeddingSchema, "vector">[]): Promise<void> {
    if (input.length === 0) {
      return;
    }
    if (!input.every((v) => v.contentHash === input[0].contentHash)) {
      throw new Error("All chunks must have the same content hash");
    }
    if (await this.writer.hasContent(input[0].contentHash)) {
      // The content is already indexed
      logger.debug(
        `Content already indexed without changes. source="${
          uriWithoutFragment(input[0].uri)
        }"`,
      );
      return;
    }

    // Map of documents to content hashes
    const outdatedDocs = new Map<string, Set<string>>();
    for (const chunk of input) {
      // There is existing content with a different source/contentHash, we can reuse the vector without having to generate it again
      const existing = await this.writer.getItem(chunk.content);

      if (existing) {
        logger.debug(
          `Existing content found, reusing vector data source="${chunk.uri}"`,
        );
        const existingUri = uriWithoutFragment(existing.uri);
        const chunkUri = uriWithoutFragment(chunk.uri);
        if (existingUri === chunkUri) {
          outdatedDocs.set(
            existingUri,
            (outdatedDocs.get(existingUri) || new Set()).add(
              existing.contentHash,
            ),
          );
        }
      }

      const vector = existing
        ? existing.vector
        : (await this.#generateEmbedding(chunk.content))[0];
      this.writer.write([{ ...chunk, vector }]);
    }

    if (outdatedDocs.size > 0) {
      for (const [uri, contentHashes] of outdatedDocs) {
        for (const contentHash of contentHashes) {
          logger.debug(
            `Removing outdated content, source="${uri}" contentHash="${contentHash}"`,
          );
          await this.writer.removeContent(contentHash);
        }
      }
    }
  }
}

function uriWithoutFragment(uri: string): string {
  const url = new URL(uri);
  url.hash = "";
  return url.toString();
}
