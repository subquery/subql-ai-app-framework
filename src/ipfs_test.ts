import { expect } from "@std/expect";
import { IPFSClient } from "./ipfs.ts";

const ipfs = new IPFSClient(
  Deno.env.get("IPFS_ENDPOINT") ??
    "https://unauthipfs.subquery.network/ipfs/api/v0/",
  {
    Authorization: `Bearer: ${Deno.env.get("SUBQL_ACCESS_TOKEN")}`,
  },
);

Deno.test("upload a file to IPFS", async () => {
  const [res] = await ipfs.addFile(["hello world"]);

  expect(res.cid).toBe("Qmf412jQZiuVUtdgnB36FXFX7xg5V6KEbSJ4dpQuhkLyfD");
});

Deno.test("upload multiple files to ipfs", async () => {
  const [res0, res1] = await ipfs.addFile(["hello world", "foo bar"]);

  expect(res0.cid).toBe("Qmf412jQZiuVUtdgnB36FXFX7xg5V6KEbSJ4dpQuhkLyfD");
  expect(res1.cid).toBe("QmRFYwD1sna2Tqzq45yq5UccjYkDBVN9NYNBxrPXKmKjNv");
});

Deno.test("cat a file", async () => {
  const data = await ipfs.cat("Qmf412jQZiuVUtdgnB36FXFX7xg5V6KEbSJ4dpQuhkLyfD");

  expect(new TextDecoder().decode(data)).toEqual("hello world");
});

// Deno.test("upload stream to ipfs", async () => {

//     const readable = await tarDir('./subquery-delegator/network-delegation-helper/db')

//     const [res] = await ipfs.addFileStream(readable);
//     expect(res.cid).toBe("Qmf412jQZiuVUtdgnB36FXFX7xg5V6KEbSJ4dpQuhkLyfD");
// });
