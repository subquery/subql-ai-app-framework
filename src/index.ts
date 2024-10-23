#!/usr/bin/env -S deno run --allow-env --allow-net --allow-sys --allow-read --allow-write --allow-ffi --allow-run --allow-import --unstable-worker-options --no-prompt
// TODO limit --allow-ffi to just lancedb
// TODO limit --deny-net on localhost except ollama/db
// TODO limit --allow-run needed for Deno.exit
// Allow sys is for docker, pino
// Allow run is for esbuild
// Allow write is for tmp directory access
// Allow read is for reading form tmp and projects

import "@std/dotenv/load"; // Automatically load .env
import { resolve } from "@std/path/resolve";
// @ts-types="npm:@types/yargs@17.0.33"
import yargs, {
  type ArgumentsCamelCase,
  type InferredOptionTypes,
  type Options,
} from "yargs/yargs";

import { IPFSClient } from "./ipfs.ts";
import ora from "ora";
import { getPrompt, setSpinner } from "./util.ts";
import denoCfg from "../deno.json" with { type: "json" };
import { initLogger } from "./logger.ts";

const DEFAULT_PORT = 7827;

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

const debugArgs = {
  debug: {
    description: "Enable debug logging",
    type: "boolean",
    default: false,
  },
  logFmt: {
    description: "Set the logger format",
    type: "string",
    choices: ["json", "pretty"],
    default: "pretty",
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
  .scriptName("subql-ai")
  .version(denoCfg.version)
  .command(
    "$0",
    "Run a SubQuery AI app",
    {
      ...sharedArgs,
      ...debugArgs,
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
        default: "http",
      },
      port: {
        description: "The port the http service runs on",
        type: "number",
        default: DEFAULT_PORT,
        // TODO set max value
      },
      forceReload: {
        description:
          "If the project is from IPFS force reload it and don't use the cached version",
        type: "boolean",
        default: false,
      },
      toolTimeout: {
        description:
          "Set a limit for how long a tool can take to run, unit is MS",
        type: "number",
        default: 10_000, // 10s
      },
    },
    async (argv) => {
      try {
        await initLogger(
          argv.logFmt as "json" | "pretty",
          argv.debug ? "debug" : undefined,
        );

        const { runApp } = await import("./app.ts");

        return await runApp({
          projectPath: argv.project,
          host: argv.host,
          interface: argv.interface as "cli" | "http",
          port: argv.port,
          ipfs: ipfsFromArgs(argv),
          forceReload: argv.forceReload,
          toolTimeout: argv.toolTimeout,
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
      ...sharedArgs,
      ...debugArgs,
      json: {
        description: "Log the project in JSON format",
        default: false,
        type: "boolean",
      },
    },
    async (argv) => {
      try {
        await initLogger(
          argv.logFmt as "json" | "pretty",
          argv.debug ? "debug" : undefined,
        );
        const { projectInfo } = await import("./subcommands/info.ts");
        await projectInfo(argv.project, ipfsFromArgs(argv), argv.json);
        Deno.exit(0);
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
        const { generate } = await import(
          "./embeddings/generator/generator.ts"
        );
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
    "repl",
    "Creates a CLI chat with a running app",
    {
      host: {
        description: "The endpoint the AI app is exposed",
        type: "string",
        default: `http://localhost:${DEFAULT_PORT}`,
      },
    },
    async (argv) => {
      const { httpCli } = await import("./subcommands/httpCli.ts");
      await httpCli(argv.host);
    },
  )
  .command(
    "publish",
    "Publishes a project to IPFS so it can be easily distributed",
    {
      ...sharedArgs,
      ...debugArgs,
      silent: {
        description: "Disable all logging except for the output",
        type: "boolean",
      },
    },
    async (argv) => {
      try {
        if (!argv.silent) {
          await initLogger(
            argv.logFmt as "json" | "pretty",
            argv.debug ? "debug" : undefined,
          );
        }

        const { publishProject } = await import("./subcommands/bundle.ts");
        if (argv.silent) {
          setSpinner(ora({ isSilent: true }));
        }

        const cid = await publishProject(
          argv.project,
          ipfsFromArgs(argv),
        );

        console.log(cid);
        Deno.exit(0);
      } catch (e) {
        console.log(e);
        Deno.exit(1);
      }
    },
  )
  .command(
    "init",
    "Create a new project skeleton",
    {
      name: {
        description:
          "The name of your project, this will create a directory with that name.",
        type: "string",
      },
      model: {
        description: "The LLM model you wish to use",
        type: "string",
      },
    },
    async (argv) => {
      try {
        argv.name ??= getPrompt("Enter a project name: ");
        argv.model ??= getPrompt("Enter a LLM model", "llama3.1");

        const { initProject } = await import("./subcommands/init.ts");

        await initProject({ name: argv.name, model: argv.model });
      } catch (e) {
        console.log(e);
        Deno.exit(1);
      }
    },
  )
  // .fail(() => {}) // Disable logging --help if theres an error with a command // TODO need to fix so it only logs when error is with yargs
  .help()
  .argv;
