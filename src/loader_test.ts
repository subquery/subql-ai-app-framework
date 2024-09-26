import { expect } from "@std/expect/expect";
import { loadVectorStoragePath } from "./loader.ts";
import { resolve } from "@std/path/resolve";
import { IPFSClient } from "./ipfs.ts";

const ipfs = new IPFSClient(
  Deno.env.get("IPFS_ENDPOINT") ??
    "https://unauthipfs.subquery.network/ipfs/api/v0",
  {
    Authorization: `Bearer: ${Deno.env.get("SUBQL_ACCESS_TOKEN")}`,
  },
);

Deno.test("Load vector storage from dir", async () => {
  const dbPath = await loadVectorStoragePath("", "./.db", ipfs);

  expect(dbPath).toBe(resolve("./.db"));
});

Deno.test("Load vector storage from cloud storage", async () => {
  const dbPath = await loadVectorStoragePath(
    "",
    "s3://my-bucket/lancedb",
    ipfs,
  );

  expect(dbPath).toBe("s3://my-bucket/lancedb");
});

Deno.test("Load vector storage from LanceDB cloud", async () => {
  const dbPath = await loadVectorStoragePath("", "db://my_database", ipfs);

  expect(dbPath).toBe("db://my_database");
});

Deno.test("Load vector storage from IPFS", async () => {
  // TODO update CID to actuall db
  const dbPath = await loadVectorStoragePath(
    "",
    "ipfs://QmbSzrfrgexP4Fugys356MYmWf3Wvk7kfEMaMNXrDXB2nd",
    ipfs,
  );

  expect(dbPath).toBe("/tmp/QmbSzrfrgexP4Fugys356MYmWf3Wvk7kfEMaMNXrDXB2nd");
});
