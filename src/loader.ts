import { dirname } from "@std/path/dirname";
import { CIDReg, IPFSClient } from "./ipfs.ts";
import { resolve } from "@std/path/resolve";
import { UntarStream } from "@std/tar";

const getOSTempDir = () =>
  Deno.env.get("TMPDIR") || Deno.env.get("TMP") || Deno.env.get("TEMP") ||
  "/tmp";

export async function loadProject(
  projectPath: string,
  ipfs: IPFSClient,
  tmpDir?: string,
): Promise<string> {
  if (CIDReg.test(projectPath)) {
    const cid = projectPath.replace("ipfs://", "");

    const tmp = resolve(tmpDir ?? getOSTempDir(), cid);
    await mkdirp(tmp);
    const filePath = resolve(tmp, "index.ts");
    const file = await Deno.open(filePath);

    const readable = await ipfs.catStream(cid);
    await readable.pipeTo(file.writable);

    return filePath;
  }

  return resolve(projectPath);
}

export async function loadVectorStoragePath(
  projectPath: string,
  vectorStoragePath: string,
  ipfs: IPFSClient,
  tmpDir?: string,
): Promise<string> {
  if (CIDReg.test(vectorStoragePath)) {
    const cid = vectorStoragePath.replace("ipfs://", "");
    const tmp = resolve(tmpDir ?? getOSTempDir(), cid);

    await mkdirp(tmp);
    const readStream = await ipfs.catStream(cid);

    for await (const entry of readStream.pipeThrough(new UntarStream())) {
      const path = resolve(tmp, entry.path);
      await entry.readable?.pipeTo((await Deno.create(path)).writable);
    }

    return tmp;
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

// Same as mkdir but doesn't throw if the file exists
async function mkdirp(path: string): Promise<void> {
  try {
    await Deno.mkdir(path);
  } catch (err) {
    if (!(err instanceof Deno.errors.AlreadyExists)) {
      throw err;
    }
  }
}
