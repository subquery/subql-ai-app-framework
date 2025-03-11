import { expect } from "@std/expect/expect";
import { crawlWebSource } from "./source.ts";

Deno.test("It gets page content", async () => {
  const pageData = await Array.fromAsync(
    crawlWebSource(
      "https://github.com/subquery/subql-ai-app-framework/blob/main/README.md",
      "none",
    ),
  );

  expect(pageData.length).toBeGreaterThan(0);
  expect(
    pageData[0].data.text.find((chunk) =>
      chunk.text.includes(
        "You can get started with detailed documentation found",
      )
    ),
  ).toBeDefined();
});
