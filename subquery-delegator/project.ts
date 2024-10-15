import { type Config, ConfigType } from "./index.ts";
import type { ProjectManifest } from "../src/project/project.ts";
import { Value } from "@sinclair/typebox/value";

const defaultConfig = Value.Default(ConfigType, {} as Config) as Config;

const endpoints = Object.values(defaultConfig)
  .filter((v) => typeof v === "string")
  .map((v) => {
    try {
      return new URL(v).hostname;
    } catch (_e) {
      return undefined;
    }
  })
  .filter((v) => !!v) as string[]; // Cast should be unnecessary with latest TS versions

const project: ProjectManifest = {
  specVersion: "0.0.1",
  endpoints: [...new Set(endpoints)],
  vectorStorage: {
    type: "lancedb",
    path: "../.db",
  },
  config: JSON.parse(JSON.stringify(ConfigType)), // Convert to JSON Schema
  model: "llama3.1",
  entry: "./index.ts",
};

export default project;
