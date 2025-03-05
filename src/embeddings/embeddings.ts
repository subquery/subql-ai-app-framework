export type EmbeddingSchema = {
  // /* Unique identifier of the record */
  // id: number | string;
  /* The vector data for the content */
  vector: number[];
  /* The source content */
  content: string;
  /* Source URI with included URI Fragments */
  uri: string;
  /* A hash of the source content document used to identify changes in content where the URI is the same. This is a base64 encoded sha256 hash */
  contentHash: string;
};

export interface IEmbeddingReader {
  search(query: string): Promise<EmbeddingSchema[]>;
}

export interface IEmbeddingWriter {
  write(input: EmbeddingSchema[]): Promise<void>;

  close(): Promise<void>;
}

export interface IEmbeddingStorage extends IEmbeddingReader, IEmbeddingWriter {
  // Checks if there is data from a document with matching contentHash
  hasContent(contentHash: string): Promise<boolean>;

  // Removes all the content of a document with matching contentHash
  removeContent(contentHash: string): Promise<void>;

  // Gets an item by its content, this is used as a cache for the vector data
  getItem(content: string): Promise<EmbeddingSchema | undefined>;
}
