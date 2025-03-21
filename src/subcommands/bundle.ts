import { resolve } from "@std/path/resolve";
import { TarStream, type TarStreamInput } from "@std/tar";
import { walk } from "@std/fs/walk";
import { dirname } from "@std/path/dirname";
import { toBlob } from "@std/streams";
import type { IPFSClient } from "../ipfs.ts";
// Supporting WASM would allow dropping `--allow-run` option but its not currently supported https://github.com/evanw/esbuild/pull/2968
// import * as esbuild from "https://deno.land/x/esbuild@v0.24.0/wasm.js";
// import * as esbuild from "esbuild";
import { denoPlugins } from "@luca/esbuild-deno-loader";
import { getSpinner } from "../util.ts";
import { Loader } from "../loader.ts";

export async function publishProject(
  projectPath: string,
  ipfs: IPFSClient,
): Promise<string> {
  const loader = new Loader(projectPath, ipfs);

  const [_, manifest, source] = await loader.getManifest();
  if (source !== "local") {
    throw new Error("Cannot bundle a project that isn't local");
  }

  // Upload project
  const [project, projectSource] = await loader.getProject();
  if (projectSource === "local") {
    const spinner = getSpinner().start("Publishing project code");
    try {
      const code = await generateBundle(project);
      const [{ cid: codeCid }] = await ipfs.addFile([code]);
      manifest.entry = `ipfs://${codeCid}`;
      spinner.succeed("Published project code");
    } catch (e) {
      spinner.fail("Failed to publish project code");
      throw e;
    }
  }

  // Upload vector db
  const vectorDbPath = manifest.vectorStorage?.path;
  if (vectorDbPath) {
    // Resolve the db path relative to the project
    const dbPath = resolve(dirname(projectPath), vectorDbPath);

    // Check that the dir exists, this excludes dbs that are already remote, e.g. s3, ipfs.
    if (await fsExists(dbPath)) {
      const spinner = getSpinner().start("Preparing and publishing vector db");
      try {
        // Check if already an archive
        if (dbPath.endsWith(".gz")) {
          const dbBuf = await Deno.readFile(dbPath);

          const [{ cid }] = await ipfs.addFile([dbBuf]);

          // Update manifest
          manifest.vectorStorage!.path = `ipfs://${cid}`;
        } else {
          const dbArchive = await tarDir(dbPath);

          const blob = await toBlob(dbArchive);
          const [{ cid }] = await ipfs.addFile([blob]);

          // Update manifest
          manifest.vectorStorage!.path = `ipfs://${cid}`;
        }

        spinner.succeed("Published vector db");
      } catch (e) {
        spinner.fail("Failed to publish project vectordb");
        throw e;
      }
    }
  }

  // Upload manifest
  const spinner = getSpinner().start("Publishing project to IPFS");
  const [{ cid }] = await ipfs.addFile([JSON.stringify(manifest, null, 2)]);
  spinner.succeed("Published project to IPFS");
  return `ipfs://${cid}`;
}

export async function generateBundle(projectPath: string): Promise<string> {
  const spinner = getSpinner().start("Generating project bundle");
  try {
    const esbuild = await import("esbuild");
    const res = await esbuild.build({
      plugins: [...denoPlugins()],
      entryPoints: [projectPath],
      bundle: true,
      write: false,
      format: "esm",
      treeShaking: true,
      minify: true,
      keepNames: true, // Stop minify scrambling tool names based on classes
    });

    // Not sure why this is required
    await esbuild.stop();

    if (res.outputFiles.length !== 1) {
      throw new Error("Output should be a single file");
    }

    const code = new TextDecoder().decode(res.outputFiles[0].contents);
    spinner.succeed("Generated project bundle");
    return code;
  } catch (e) {
    spinner.fail("Failed to generate project bundle");
    throw e;
  }
}

/**
 * Archives the lancedb directory into a file for uploading
 * @param dbPath The path to the lancedb directory
 * @returns
 */
export async function tarDir(
  dirPath: string,
): Promise<ReadableStream<Uint8Array>> {
  const inputs: TarStreamInput[] = [];

  for await (const entry of walk(dirPath)) {
    if (entry.isDirectory) {
      inputs.push({
        type: "directory",
        path: entry.path.replace(dirPath, "."),
      });
    }
    if (entry.isFile) {
      inputs.push({
        type: "file",
        path: entry.path.replace(dirPath, "."),
        size: (await Deno.stat(entry.path)).size,
        readable: (await Deno.open(entry.path)).readable,
      });
    }
    // Symlink not handled
  }

  return ReadableStream.from(inputs)
    .pipeThrough(new TarStream())
    .pipeThrough(new CompressionStream("gzip"));
}

async function fsExists(path: string): Promise<boolean> {
  try {
    await Deno.lstat(path);
    return true;
  } catch (_e) {
    return false;
  }
}
