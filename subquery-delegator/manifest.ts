import { type Config, ConfigType } from "./project.ts";
import type { ProjectManifest } from "../src/project/project.ts";
import { Value } from "@sinclair/typebox/value";
import { extractConfigHostNames } from "../src/util.ts";

const defaultConfig = Value.Default(ConfigType, {} as Config) as Config;

const project: ProjectManifest = {
  specVersion: "0.0.1",
  endpoints: extractConfigHostNames(defaultConfig),
  vectorStorage: {
    type: "lancedb",
    path: "../.db",
  },
  config: JSON.parse(JSON.stringify(ConfigType)), // Convert to JSON Schema
  model: "llama3.1",
  entry: "./project.ts",
};

export default project;
