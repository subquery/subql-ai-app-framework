export interface IEmbeddingReader {
  search(query: string): Promise<string[]>;
}

export interface IEmbeddingWriter {
  write(input: string | string[]): Promise<void>;

  close(): Promise<void>;
}
