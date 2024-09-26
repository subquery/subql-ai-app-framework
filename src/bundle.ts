import { getProjectJson } from "./info.ts";
import { resolve } from "@std/path/resolve";
import { Tar } from "@std/archive/tar";
import { walk } from "@std/fs/walk";
import { dirname } from "@std/path/dirname";
import { Buffer } from "@std/io/buffer";
import type { Reader } from "@std/io/types";
import { IPFSClient } from "./ipfs.ts";
import * as esbuild from "esbuild";
import { denoPlugins } from "@luca/esbuild-deno-loader";
import { getDefaultSandbox } from "./sandbox/index.ts";

export async function publishProject(
  projectPath: string,
  ipfs: IPFSClient,
  sandboxFactory = getDefaultSandbox,
): Promise<string> {
  projectPath = await Deno.realPath(projectPath);
  const projectJson = await getProjectJson(projectPath, sandboxFactory);

  const code = await generateBundle(projectPath);
  const vectorDbPath = projectJson.vectorStorage?.path;
  if (vectorDbPath) {
    // Resolve the db path relative to the project
    const dbPath = resolve(dirname(projectPath), vectorDbPath);
    // Check that the dir exists, this excludes dbs that are already remote, e.g. s3, ipfs.
    if (await fsExists(dbPath)) {
      const dbArchive = await tarDir(dbPath);

      // TODO loading the whole archive into memory is not ideal and should be streamed.
      // Need to find a way to stream uploads to ipfs
      const dbBuf = new Buffer();
      await dbBuf.readFrom(dbArchive);

      const [{ cid }] = await ipfs.addFile([dbBuf]);

      updateProjectVectorDbPath(
        code,
        vectorDbPath,
        `ipfs://${cid}`,
      );
    }
  }

  const [{ cid }] = await ipfs.addFile([code]);
  return `ipfs://${cid}`;
}

export async function generateBundle(projectPath: string): Promise<string> {
  const res = await esbuild.build({
    plugins: [...denoPlugins()],
    entryPoints: [projectPath],
    bundle: true,
    write: false,
    format: "esm",
  });

  // Not sure why this is required
  esbuild.stop();

  if (res.outputFiles.length !== 1) {
    throw new Error("Output should be a single file");
  }

  return new TextDecoder().decode(res.outputFiles[0].contents);
}

/**
 * @param code The raw bundled code
 * @param currentPath The current db path that will get replaced
 * @param newPath The new db path to replace
 * @returns Updated raw bundled code
 */
function updateProjectVectorDbPath(
  code: string,
  currentPath: string,
  newPath: string,
): string {
  return code.replaceAll(currentPath, newPath);
}

/**
 * Archives the lancedb directory into a file for uploading
 * @param dbPath The path to the lancedb directory
 * @returns
 */
export async function tarDir(dirPath: string): Promise<Reader> {
  const tar = new Tar();

  for await (const entry of walk(dirPath)) {
    if (!entry.isFile) {
      continue;
    }
    await tar.append(entry.path, {
      filePath: entry.path,
    });
  }

  return tar.getReader();
}

async function fsExists(path: string): Promise<boolean> {
  try {
    await Deno.lstat(path);
    return true;
  } catch (e) {
    return false;
  }
}
