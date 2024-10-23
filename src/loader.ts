import { dirname } from "@std/path/dirname";
import { resolve } from "@std/path/resolve";
import { fromFileUrl } from "@std/path/from-file-url";
import { toFileUrl } from "@std/path/to-file-url";
import { CIDReg, type IPFSClient } from "./ipfs.ts";

import { UntarStream } from "@std/tar";
import { ensureDir, exists } from "@std/fs";
import type { Source } from "./util.ts";
import { ProjectManifest } from "./project/project.ts";
import { Value } from "@sinclair/typebox/value";
import { Memoize, SpinnerLog } from "./decorators.ts";
import { getLogger } from "./logger.ts";

const logger = await getLogger("loader");

const toFileUrlString = (input: string) => toFileUrl(input).toString();

export const getOSTempDir = () =>
  Deno.env.get("TMPDIR") || Deno.env.get("TMP") || Deno.env.get("TEMP") ||
  "/tmp";

async function loadJson(path: string): Promise<unknown> {
  const decoder = new TextDecoder();
  const data = await Deno.readFile(path);
  const raw = decoder.decode(data);

  return JSON.parse(raw);
}

async function loadScript(path: string): Promise<unknown> {
  const { default: raw } = await import(path);
  return raw;
}

/**
 * Loads a local manifest file (either json, ts or js)
 */
async function loadManfiest(path: string): Promise<ProjectManifest> {
  let manifest: unknown;
  try {
    manifest = await loadJson(path);
  } catch (_e: unknown) {
    manifest = await loadScript(path);
  }

  try {
    Value.Assert(ProjectManifest, manifest);
  } catch (e) {
    throw new Error(`${path} is not a valid project manifest`, { cause: e });
  }

  return manifest;
}

/**
 * @param path The content path or cid
 * @param ipfs The IPFS client to fetch content if from IPFS
 * @param fileName The name to save the file under, if using .gz exension it will unarchive
 * @param tmpDir (optional) The location to cache content, defaults to the OS temp directory
 * @param force  (optional) If true and the content is from IPFS it will check if its already been fetched
 * @param workingPath (optional) If the content is local it will resolve the path relative to this
 * @returns
 */
export async function pullContent(
  path: string,
  ipfs: IPFSClient,
  fileName: string,
  tmpDir?: string,
  force?: boolean,
  workingPath?: string,
): Promise<[string, Source]> {
  if (CIDReg.test(path)) {
    const cid = path.replace("ipfs://", "");
    const tmp = resolve(tmpDir ?? getOSTempDir(), cid);
    await ensureDir(tmp);

    if (fileName.endsWith(".gz")) {
      const readStream = await ipfs.catStream(cid);

      if (!force && (await exists(tmp))) {
        return [toFileUrlString(tmp), "ipfs"];
      }

      for await (
        const entry of readStream.pipeThrough(new DecompressionStream("gzip"))
          .pipeThrough(new UntarStream())
      ) {
        const path = resolve(tmp, entry.path);
        await ensureDir(dirname(path));
        await entry.readable?.pipeTo((await Deno.create(path)).writable);
      }
      return [toFileUrlString(tmp), "ipfs"];
    } else {
      const filePath = resolve(tmp, fileName);
      // Early exit if the file has already been fetched
      if (!force && (await exists(filePath))) {
        return [toFileUrlString(filePath), "ipfs"];
      }

      const file = await Deno.open(filePath, { create: true, write: true });

      const readable = await ipfs.catStream(cid);
      await readable.pipeTo(file.writable);

      return [toFileUrlString(filePath), "ipfs"];
    }
  }

  try {
    // This should throw if the project is not a valid URL. This allows loading lancedb from gcs/s3
    const url = new URL(path);

    if (url.protocol === "file:") {
      return [path, "local"];
    }

    return [path, "remote"];
  } catch (_e) {
    // DO nothing
  }

  // File urls are used to avoid imports being from the same package registry as the framework is run from
  workingPath = workingPath?.startsWith("file://")
    ? fromFileUrl(workingPath)
    : workingPath;
  return [toFileUrlString(resolve(workingPath ?? "", path)), "local"];
}

export class Loader {
  #ipfs: IPFSClient;
  #force: boolean;

  constructor(
    readonly projectPath: string,
    ipfs: IPFSClient,
    readonly tmpDir?: string,
    force?: boolean,
  ) {
    this.#ipfs = ipfs;
    this.#force = force ?? false;
  }

  private async pullContent(
    path: string,
    fileName: string,
    tmpDir = this.tmpDir,
    workingPath?: string,
  ): Promise<[string, Source]> {
    return await pullContent(
      path,
      this.#ipfs,
      fileName,
      tmpDir,
      this.#force,
      workingPath,
    );
  }

  @Memoize()
  @SpinnerLog({
    start: "Loading project manifest",
    success: "Loaded project manifest",
    fail: "Failed to load project manfiest",
  })
  async getManifest(): Promise<[string, ProjectManifest, Source]> {
    const [manifestPath, source] = await this.pullContent(
      this.projectPath,
      "manifest.json",
      undefined,
      Deno.cwd(),
    );

    logger.debug(`getManifest [${source}] ${manifestPath}`);
    const manifest = await loadManfiest(manifestPath);

    return [manifestPath, manifest, source];
  }

  @SpinnerLog({
    start: "Loading project source",
    success: "Loaded project source",
    fail: "Failed to load project source",
  })
  async getProject(): Promise<[string, Source]> {
    const [manifestPath, manifest, manifestSource] = await this.getManifest();
    const [projectPath, source] = await this.pullContent(
      manifest.entry,
      "project.ts",
      dirname(manifestPath),
      manifestSource == "local" ? dirname(this.projectPath) : undefined,
    );
    logger.debug(`getProject [${source}] ${projectPath}`);
    return [projectPath, source];
  }

  @SpinnerLog({
    start: "Loading vector db",
    success: "Loaded vector db",
    fail: "Failed to load vector db",
  })
  async getVectorDb(): Promise<[string, Source] | undefined> {
    const [manifestPath, manifest, manifestSource] = await this.getManifest();
    if (!manifest.vectorStorage?.path) {
      return undefined;
    }

    const res = await this.pullContent(
      manifest.vectorStorage.path,
      "db.gz",
      dirname(manifestPath),
      manifestSource == "local" ? dirname(this.projectPath) : undefined,
    );
    return res;
  }
}
