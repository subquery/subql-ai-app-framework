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
import { getPrompt, getVersion, setSpinner } from "./util.ts";
import { initLogger } from "./logger.ts";
import { DEFAULT_LLM_HOST, DEFAULT_PORT } from "./constants.ts";
import type { Scope } from "./embeddings/generator/web/source.ts";
import plimit from "p-limit";

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
  cacheDir: {
    description:
      "The location to cache data from ipfs. Default is a temp directory",
    type: "string",
  },
} satisfies Record<string, Options>;

const llmHostArgs = {
  host: {
    alias: "h",
    description:
      "The LLM RPC host. If the project model uses an OpenAI model then the default value is not used.",
    default: DEFAULT_LLM_HOST,
    type: "string",
  },
  openAiApiKey: {
    description:
      "If the project models use OpenAI models, then this api key will be parsed on to the OpenAI client",
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
  .version(await getVersion())
  .command(
    "$0",
    "Run a SubQuery AI app",
    {
      ...sharedArgs,
      ...debugArgs,
      ...llmHostArgs,
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
      streamKeepAlive: {
        description:
          "The interval in MS to send empty data in stream responses to keep the connection alive. Only wokrs with http interface. Use 0 to disable.",
        type: "number",
        default: 5_000, // 5s
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
          streamKeepAlive: argv.streamKeepAlive,
          cacheDir: argv.cacheDir,
          openAiApiKey: argv.openAiApiKey,
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
    ["embed", "embed-web", "embed-mdx"], // embed-web and embed-mdx are for backwards compatibility
    "Creates a Lance db table with embeddings from a web or markdown source",
    {
      ...debugArgs,
      ...llmHostArgs,
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
      model: {
        description:
          "The embedding LLM model to use, this should be the same as embeddingsModel in your app manifest",
        required: true,
        type: "string",
      },
      overwrite: {
        description: "If there is an existing table, then overwrite it",
        type: "boolean",
        default: false,
      },
      dimensions: {
        description:
          "The number of dimensions for the LLM model to use. NOTE: Ollama models doesn't currently support modifying this so it will throw if the output doesn't match.",
        type: "number",
      },
      input: {
        alias: "i",
        description: "The url of the website to pull data from",
        required: true,
        type: "string",
      },
      scope: {
        description: "",
        choises: ["none", "domain", "subdomains"] satisfies Scope[],
        default: "domain",
      },
      collectionName: {
        description:
          "The name of the set of web pages to generate embeddings for. This is used to keep track of all the web pages in the collection. Defaults to the input url.",
        type: "string",
        required: false,
      },
      ignore: {
        description:
          "Input paths to ignore, this can be glob patterns. e.g '/**/node_modules/**' or 'https://subquery.network/404 ",
        type: "array",
        string: true,
      },
      llmConcurrency: {
        description:
          "The number of concurrent requests to the LLM model. This is used to limit the number of requests to the model at once. 0 to disable",
        type: "number",
        default: 1000,
      },
    },
    async (argv) => {
      try {
        await initLogger(
          argv.logFmt as "json" | "pretty",
          argv.debug ? "debug" : undefined,
        );

        const { getGenerateFunction } = await import("./runners/runner.ts");
        const limit = plimit(argv.llmConcurrency > 0 ? argv.llmConcurrency : 1);

        const originalGenerateFunction = await getGenerateFunction(
          argv.host,
          argv.model,
          argv.openAiApiKey,
        );

        const generateFunction = (
          text: string | string[],
          dimensions?: number,
        ) => limit(() => originalGenerateFunction(text, dimensions));

        // Determine the dimensions, if not provided it will use the result dimensions from a test
        const dimensions = argv.dimensions ??
          (await generateFunction("this is a test"))[0].length;

        if (argv.input.startsWith("http")) {
          const { generate } = await import(
            "./embeddings/generator/web/generator.ts"
          );

          await generate(
            argv.input,
            resolve(argv.output),
            argv.table,
            generateFunction,
            dimensions,
            argv.scope as Scope,
            argv.ignore,
            argv.overwrite,
            argv.collectionName,
          );
        } else { // MD(X)
          const { generateToTable } = await import(
            "./embeddings/generator/md/generator.ts"
          );

          await generateToTable(
            resolve(argv.input),
            resolve(argv.output),
            argv.table,
            generateFunction,
            dimensions,
            argv.ignore?.map((f) => resolve(f)),
            argv.overwrite,
            argv.collectionName,
          );
        }
        Deno.exit(0);
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
      stream: {
        description: "Stream responses",
        type: "boolean",
        default: true,
      },
      apiKey: {
        description: "If the host requires an API use this to set it.",
        type: "string",
        default: "",
      },
    },
    async (argv) => {
      const { httpCli } = await import("./subcommands/httpCli.ts");
      await httpCli(argv.host, argv.stream, argv.apiKey);
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
  .strict()
  // .fail(() => {}) // Disable logging --help if theres an error with a command // TODO need to fix so it only logs when error is with yargs
  .help()
  .argv;
