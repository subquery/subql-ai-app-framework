import { expect } from "@std/expect/expect";
import { getOSTempDir, pullContent } from "./loader.ts";
import { resolve } from "@std/path/resolve";
import { IPFSClient } from "./ipfs.ts";
import { tarDir } from "./bundle.ts";

const ipfs = new IPFSClient(
  Deno.env.get("IPFS_ENDPOINT") ??
    "https://unauthipfs.subquery.network/ipfs/api/v0",
  {
    Authorization: `Bearer: ${Deno.env.get("SUBQL_ACCESS_TOKEN")}`,
  },
);

Deno.test("Load vector storage from dir", async () => {
  const dbPath = await pullContent("./.db", ipfs, "");

  expect(dbPath).toBe(resolve("./.db"));
});

Deno.test("Load vector storage from cloud storage", async () => {
  const [dbPath] = await pullContent(
    "s3://my-bucket/lancedb",
    ipfs,
    "",
  );

  expect(dbPath).toBe("s3://my-bucket/lancedb");
});

Deno.test("Load vector storage from LanceDB cloud", async () => {
  const [dbPath] = await pullContent("db://my_database", ipfs, "");

  expect(dbPath).toBe("db://my_database");
});

Deno.test("Load vector storage from IPFS", async () => {
  // Because of limitations to the IPFS gateway its easier just to pipe from source
  const mockIpfs = {
    catStream: (() => tarDir(resolve("./.db"))) satisfies IPFSClient[
      "catStream"
    ],
  } as unknown as IPFSClient;

  const [dbPath] = await pullContent(
    "ipfs://QmbSzrfrgexP4Fugys356MYmWf3Wvk7kfEMaMNXrDXB2nd",
    mockIpfs,
    "",
  );

  expect(dbPath).toBe(
    resolve(getOSTempDir(), "QmbSzrfrgexP4Fugys356MYmWf3Wvk7kfEMaMNXrDXB2nd"),
  );

  // Clean up
  await Deno.remove(dbPath, { recursive: true });
});
