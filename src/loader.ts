import { dirname } from "@std/path/dirname";
import { resolve } from "@std/path/resolve";
import { CIDReg, type IPFSClient } from "./ipfs.ts";
import { UntarStream } from "@std/tar";
import { ensureDir, exists } from "@std/fs";
import { fromFileUrlSafe, type Source, toFileUrlString } from "./util.ts";
import { ProjectManifest } from "./project/project.ts";
import { Value } from "@sinclair/typebox/value";
import { Memoize, SpinnerLog } from "./decorators.ts";
import { getLogger } from "./logger.ts";

const logger = await getLogger("loader");

export const getOSTempDir = () =>
  Deno.env.get("TMPDIR") ||
  Deno.env.get("TMP") ||
  Deno.env.get("TEMP") ||
  "/tmp";

async function loadJson(path: string): Promise<unknown> {
  const decoder = new TextDecoder();
  const normalPath = fromFileUrlSafe(path);
  const data = await Deno.readFile(normalPath);
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
  } catch (e: unknown) {
    logger.debug(`Manifest is not json, ${(e as Error).message}`);
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
 * Extract an archive from a readable stream into a given directory
 * @param readable A readable stream of the archive content
 * @param dest The destination directory
 * @returns The path of the first entry, usually a directory name
 */
async function extractArchive(
  readable: ReadableStream<Uint8Array>,
  dest: string
): Promise<string | undefined> {
  let first: string | undefined;
  for await (const entry of readable
    .pipeThrough(new DecompressionStream("gzip"))
    .pipeThrough(new UntarStream())) {
    const path = resolve(dest, entry.path);
    if (!first) {
      first = path;
    }
    await ensureDir(dirname(path));
    // Readable only exists for files, not directories
    await entry.readable?.pipeTo((await Deno.create(path)).writable);
  }

  return first;
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
  workingPath?: string
): Promise<[string, Source]> {
  if (CIDReg.test(path)) {
    const cid = path.replace("ipfs://", "");
    const tmp = resolve(fromFileUrlSafe(tmpDir ?? getOSTempDir()), cid);
    await ensureDir(tmp);

    if (fileName.endsWith(".gz")) {
      const readStream = await ipfs.catStream(cid);

      if (!force && (await exists(tmp))) {
        return [toFileUrlString(tmp), "ipfs"];
      }

      await extractArchive(readStream, tmp);

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

  let url: URL | undefined;

  try {
    // This should throw if not a valid url
    url = new URL(path);
  } catch (_e) {
    // Do nothing
  }

  if (url) {
    if (url.protocol === "file:") {
      return [path, "local"];
    }

    if (url.protocol === "http:" || url.protocol === "https:") {
      const headRes = await fetch(url, { method: "HEAD" });
      // Github returns application/octetstream so we fallback to inspecting the url for a file ext
      if (
        headRes.headers.get("Content-Type") === "application/gzip" ||
        url.pathname.endsWith(".gz")
      ) {
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        if (!res.body) {
          throw new Error(`Failed to load ${url.toString()}, empty body`);
        }

        const tmp = resolve(
          fromFileUrlSafe(tmpDir ?? (await Deno.makeTempDir()))
        );
        try {
          const p = await extractArchive(res.body, tmp);

          // Is this correct? The file is technically local now
          return [p ?? tmp, "remote"];
        } catch (e) {
          throw new Error("Failed to fetch archive from http", { cause: e });
        }
      }
    }

    return [path, "remote"];
  }

  const localPath = resolve(fromFileUrlSafe(workingPath ?? ""), path);
  if (localPath.endsWith(".gz")) {
    const tmp = resolve(fromFileUrlSafe(tmpDir ?? (await Deno.makeTempDir())));

    const archive = await Deno.open(localPath);

    try {
      await extractArchive(archive.readable, tmp);
    } finally {
      archive.close();
    }

    return [toFileUrlString(tmp), "local"];
  }

  // File urls are used to avoid imports being from the same package registry as the framework is run from
  return [toFileUrlString(localPath), "local"];
}

export class Loader {
  #ipfs: IPFSClient;
  #force: boolean;

  constructor(
    readonly projectPath: string,
    ipfs: IPFSClient,
    readonly tmpDir?: string,
    force?: boolean
  ) {
    this.#ipfs = ipfs;
    this.#force = force ?? false;
  }

  private async pullContent(
    path: string,
    fileName: string,
    tmpDir = this.tmpDir,
    workingPath?: string
  ): Promise<[string, Source]> {
    return await pullContent(
      path,
      this.#ipfs,
      fileName,
      tmpDir,
      this.#force,
      workingPath
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
      Deno.cwd()
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
      manifestSource == "local" ? dirname(this.projectPath) : undefined
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
      manifestSource == "local" ? dirname(this.projectPath) : undefined
    );
    logger.debug(`getVectorDb [${res[1]}] ${res[0]}`);
    return res;
  }
}
