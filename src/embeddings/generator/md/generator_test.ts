import { expect } from "@std/expect";
import { EmbeddingsWriter } from "../../storage/embeddingsWriter.ts";
import { generate } from "./generator.ts";
import { MemoryWriter } from "../../storage/memory/writer.ts";

Deno.test("It gets the correct schema data from a markdown file", async () => {
  const writer = new MemoryWriter();
  const testEmbedder = new EmbeddingsWriter(
    writer,
    () => Promise.resolve<number[][]>([]),
  );

  await generate("./", testEmbedder, [
    "subquery-delegator",
    "RESEARCH.md",
    "CHANGELOG.md",
  ]);

  expect(writer.data.length).toBeGreaterThan(0);

  expect(writer.data[0]).toEqual({
    collection: "./",
    content:
      "## Subquery AI App Framework  [![JSR](https://jsr.io/badges/@subql/ai-app-framework)](https://jsr.io/@subql/ai-app-framework) ",
    uri: "file://readme/#subquery-ai-app-framework",
    contentHash: "qGDVi9DYIHmrrQDGyFYB3HDNhuLoeQ7zI5BhQsCGyVA=",
    vector: undefined,
  });
});
