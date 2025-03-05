import type { EmbeddingSchema, IEmbeddingStorage } from "../../embeddings.ts";

export class MemoryWriter implements IEmbeddingStorage {
  #data: EmbeddingSchema[] = [];

  get data() {
    return this.#data;
  }

  // deno-lint-ignore require-await
  async hasContent(contentHash: string): Promise<boolean> {
    return !!this.#data.find((d) => d.contentHash === contentHash);
  }

  // deno-lint-ignore require-await
  async removeContent(contentHash: string): Promise<void> {
    for (let i = 0; i < this.#data.length; i++) {
      if (this.#data[i].contentHash === contentHash) {
        this.#data.splice(i, 1);
      }
    }
  }

  // deno-lint-ignore require-await
  async getItem(content: string): Promise<EmbeddingSchema | undefined> {
    return this.#data.find((d) => d.content === content);
  }

  search(/* query: string */): Promise<EmbeddingSchema[]> {
    throw new Error("Method not implemented.");
  }

  // deno-lint-ignore require-await
  async write(input: EmbeddingSchema[]): Promise<void> {
    this.#data.push(...input);
  }

  close(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
