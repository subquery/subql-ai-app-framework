import { dirname } from "@std/path/dirname";
import { CIDReg, IPFSClient } from "./ipfs.ts";
import { resolve } from "@std/path/resolve";
import { UntarStream } from "@std/tar";
import { ensureDir, exists } from "@std/fs";
import { getSpinner } from "./util.ts";

export const getOSTempDir = () =>
  Deno.env.get("TMPDIR") || Deno.env.get("TMP") || Deno.env.get("TEMP") ||
  "/tmp";

export async function loadProject(
  projectPath: string,
  ipfs: IPFSClient,
  tmpDir?: string,
  forceReload?: boolean,
): Promise<string> {
  if (CIDReg.test(projectPath)) {
    const spinner = getSpinner().start("Loading project from IPFS");
    try {
      const cid = projectPath.replace("ipfs://", "");

      const tmp = resolve(tmpDir ?? getOSTempDir(), cid);
      const filePath = resolve(tmp, "index.ts");
      // Early exit if the file has already been fetched
      if (!forceReload && (await exists(filePath))) {
        spinner.succeed("Loaded project from IPFS");
        return filePath;
      }
      await ensureDir(tmp);

      const file = await Deno.open(filePath, { create: true, write: true });

      const readable = await ipfs.catStream(cid);
      await readable.pipeTo(file.writable);

      spinner.succeed("Loaded project from IPFS");

      return filePath;
    } catch (e) {
      spinner.fail("Failed to load project");
      throw e;
    }
  }

  return resolve(projectPath);
}

export async function loadVectorStoragePath(
  projectPath: string,
  vectorStoragePath: string,
  ipfs: IPFSClient,
  tmpDir?: string,
  forceReload?: boolean,
): Promise<string> {
  if (CIDReg.test(vectorStoragePath)) {
    const spinner = getSpinner().start("Loading vector db from IPFS");
    try {
      const cid = vectorStoragePath.replace("ipfs://", "");
      const tmp = resolve(tmpDir ?? getOSTempDir(), cid);

      // Early exit if the file has already been fetched
      if (!forceReload && (await exists(tmp))) {
        spinner.succeed("Loaded vector db from IPFS");
        return tmp;
      }

      await ensureDir(tmp);
      const readStream = await ipfs.catStream(cid);

      for await (
        const entry of readStream.pipeThrough(new DecompressionStream("gzip"))
          .pipeThrough(new UntarStream())
      ) {
        const path = resolve(tmp, entry.path);
        await ensureDir(dirname(path));
        await entry.readable?.pipeTo((await Deno.create(path)).writable);
      }

      spinner.succeed("Loaded vector db from IPFS");
      return tmp;
    } catch (e) {
      spinner.fail("Failed to load vector db");
      throw e;
    }
  }

  try {
    const uri = new URL(vectorStoragePath);

    if (uri.protocol) {
      return vectorStoragePath;
    }
  } catch (e) {
    // DO nothing
  }

  return resolve(dirname(projectPath), vectorStoragePath);
}
