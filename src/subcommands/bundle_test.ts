import { generateBundle, publishProject } from "./bundle.ts";
import { expect } from "jsr:@std/expect";
import { IPFSClient } from "../ipfs.ts";

Deno.test("Generates a bundle", async () => {
  const code = await generateBundle("./subquery-delegator/index.ts");

  expect(code.length).toBeTruthy();
});

Deno.test("Publishing a project to ipfs", async () => {
  // WebWorkers don't work in tests, use the unsafe sandbox instead
  const cid = await publishProject(
    "./subquery-delegator/project.ts",
    new IPFSClient(
      Deno.env.get("IPFS_ENDPOINT") ??
        "https://unauthipfs.subquery.network/ipfs/api/v0",
      {
        Authorization: `Bearer: ${Deno.env.get("SUBQL_ACCESS_TOKEN")}`,
      },
    ),
  );

  // The example project could end up being modified so we only validate the response, not the content
  expect(cid.indexOf("ipfs://")).toEqual(0);
  expect(cid.length).toEqual(53); // ipfs:// + cid

  // TODO improve validation that everything was uploaded correctly
});
