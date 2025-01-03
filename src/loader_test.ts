import { expect } from "@std/expect/expect";
import { getOSTempDir, pullContent } from "./loader.ts";
import { resolve } from "@std/path/resolve";
import { IPFSClient } from "./ipfs.ts";
import { tarDir } from "./subcommands/bundle.ts";
import { fromFileUrl } from "@std/path/from-file-url";

const ipfs = new IPFSClient(
  Deno.env.get("IPFS_ENDPOINT") ??
    "https://unauthipfs.subquery.network/ipfs/api/v0",
  {
    Authorization: `Bearer: ${Deno.env.get("SUBQL_ACCESS_TOKEN")}`,
  },
);

Deno.test("Load vector storage from dir", async () => {
  const [dbPath, source] = await pullContent("./.db", ipfs, "");

  expect(dbPath).toBe("file://" + resolve("./.db"));
  expect(source).toBe("local");
});

Deno.test("Load vector storage from cloud storage", async () => {
  const [dbPath, source] = await pullContent(
    "s3://my-bucket/lancedb",
    ipfs,
    "",
  );

  expect(dbPath).toBe("s3://my-bucket/lancedb");
  expect(source).toBe("remote");
});

Deno.test("Load vector storage from LanceDB cloud", async () => {
  const [dbPath, source] = await pullContent("db://my_database", ipfs, "");

  expect(dbPath).toBe("db://my_database");
  expect(source).toBe("remote");
});

Deno.test("Load vector storage from IPFS", async () => {
  // Because of limitations to the IPFS gateway its easier just to pipe from source
  const mockIpfs = {
    catStream: (() => tarDir(resolve("./.db"))) satisfies IPFSClient[
      "catStream"
    ],
  } as unknown as IPFSClient;

  const [dbPath, source] = await pullContent(
    "ipfs://QmbSzrfrgexP4Fugys356MYmWf3Wvk7kfEMaMNXrDXB2nd",
    mockIpfs,
    "",
  );

  expect(dbPath).toBe(
    "file://" +
      resolve(getOSTempDir(), "QmbSzrfrgexP4Fugys356MYmWf3Wvk7kfEMaMNXrDXB2nd"),
  );
  expect(source).toBe("ipfs");

  // Clean up
  await Deno.remove(fromFileUrl(dbPath), { recursive: true });
});

Deno.test("Local files work with and are converted to file urls", async () => {
  const [path0] = await pullContent("file:///some/file/path", ipfs, "");
  expect(path0).toBe("file:///some/file/path");

  const [path1] = await pullContent("/some/file/path", ipfs, "");
  expect(path1).toBe("file:///some/file/path");

  const [path2] = await pullContent(
    "./some/file/path",
    ipfs,
    "",
    undefined,
    undefined,
    "/root/dir",
  );
  expect(path2).toBe("file:///root/dir/some/file/path");

  const [path3] = await pullContent(
    "./some/file/path",
    ipfs,
    "",
    undefined,
    undefined,
    "file:///root/dir",
  );
  expect(path3).toBe("file:///root/dir/some/file/path");
});
