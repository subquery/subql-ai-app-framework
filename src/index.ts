#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read --allow-ffi --allow-run
// TODO limit --allow-ffi to just lancedb
// TODO limit --deny-net on localhost except ollama/db
// TODO limit --allow-run needed for Deno.exit

import "@std/dotenv/load"; // Automatically load .env
import { resolve } from "@std/path/resolve";
import yargs from "yargs/yargs";
import { runApp } from "./app.ts";
import { generate } from "./embeddings/generator/generator.ts";
import { projectInfo } from "./info.ts";

yargs(Deno.args)
  .command(
    "$0",
    "Run an AI app",
    {
      project: {
        alias: "p",
        description: "A path to a project file",
        type: "string",
        required: true,
      },
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
    },
    async (argv) => {
      try {
        return await runApp({
          projectPath: argv.project,
          host: argv.host,
          interface: argv.interface as "cli" | "http",
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
      project: {
        alias: "p",
        description: "A path to a project file",
        type: "string",
        required: true,
      },
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
  // .fail(() => {}) // Disable logging --help if theres an error with a command // TODO need to fix so it only logs when error is with yargs
  .help()
  .argv;
