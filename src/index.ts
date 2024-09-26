#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read --allow-ffi --allow-run --unstable-worker-options
// TODO limit --allow-ffi to just lancedb
// TODO limit --deny-net on localhost except ollama/db
// TODO limit --allow-run needed for Deno.exit

import "@std/dotenv/load"; // Automatically load .env
import { resolve } from "@std/path/resolve";
// @ts-types="npm:@types/yargs"
import yargs, {
  ArgumentsCamelCase,
  InferredOptionTypes,
  Options,
} from "yargs/yargs";
import { runApp } from "./app.ts";
import { generate } from "./embeddings/generator/generator.ts";
import { projectInfo } from "./info.ts";
import { publishProject } from "./bundle.ts";
import { IPFSClient } from "./ipfs.ts";

const sharedArgs = {
  project: {
    alias: "p",
    description: "A path to a project file",
    type: "string",
    required: true,
  },
  ipfsEndpoint: {
    description: "An endpoint to an IPFS gateway",
    type: "string",
    default: "https://unauthipfs.subquery.network/ipfs/api/v0/",
  },
  ipfsAccessToken: {
    description:
      "A bearer authentication token to be used with the ipfs endpoint",
    type: "string",
  },
} satisfies Record<string, Options>;

function ipfsFromArgs(
  argv: ArgumentsCamelCase<InferredOptionTypes<typeof sharedArgs>>,
): IPFSClient {
  return new IPFSClient(argv.ipfsEndpoint, {
    Authorization: `Bearer ${argv.ipfsAccessToken}`,
  });
}

yargs(Deno.args)
  .env("SUBQL_AI")
  .command(
    "$0",
    "Run an AI app",
    {
      ...sharedArgs,
      host: {
        alias: "h",
        description: "The ollama RPC host",
        default: "http://localhost:11434",
        type: "string",
      },
      interface: {
        alias: "i",
        description: "The interface to interact with the app",
        type: "string",
        choices: ["cli", "http"],
        default: "cli",
      },
      port: {
        description: "The port the http service runs on",
        type: "number",
        default: 7827,
        // TODO set max value
      },
    },
    async (argv) => {
      try {
        return await runApp({
          projectPath: argv.project,
          host: argv.host,
          interface: argv.interface as "cli" | "http",
          port: argv.port,
          ipfs: ipfsFromArgs(argv),
        });
      } catch (e) {
        console.log(e);
        Deno.exit(1);
      }
    },
  )
  .command(
    "info",
    "Get information on a project",
    {
      project: sharedArgs.project,
      json: {
        description: "Log the project in JSON format",
        default: false,
        type: "boolean",
      },
    },
    async (argv) => {
      try {
        return await projectInfo(argv.project, argv.json);
      } catch (e) {
        console.log(e);
        Deno.exit(1);
      }
    },
  )
  .command(
    "embed-mdx",
    "Creates a Lance db table with embeddings from MDX files",
    {
      input: {
        alias: "i",
        description: "Path to a directory containing MD or MDX files",
        required: true,
        type: "string",
      },
      output: {
        alias: "o",
        description: "The db output directory",
        required: true,
        type: "string",
      },
      table: {
        alias: "t",
        description: "The table name",
        required: true,
        type: "string",
      },
      ignoredFiles: {
        description: "Input files to ignore",
        type: "array",
        string: true,
      },
    },
    async (argv) => {
      try {
        return await generate(
          resolve(argv.input),
          resolve(argv.output),
          argv.table,
          argv.ignoredFiles?.map((f) => resolve(f)),
        );
      } catch (e) {
        console.log(e);
        Deno.exit(1);
      }
    },
  )
  .command(
    "publish",
    "Publishes a project to IPFS so it can be easily distributed",
    {
      ...sharedArgs,
    },
    async (argv) => {
      try {
        const cid = await publishProject(
          argv.project,
          ipfsFromArgs(argv),
        );

        console.log(cid);
      } catch (e) {
        console.log(e);
        Deno.exit(1);
      }
    },
  )
  // .fail(() => {}) // Disable logging --help if theres an error with a command // TODO need to fix so it only logs when error is with yargs
  .help()
  .argv;
