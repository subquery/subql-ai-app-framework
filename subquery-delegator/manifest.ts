import { type Config, ConfigType } from "./project.ts";
import type { ProjectManifest } from "../src/project/project.ts";
import { Value } from "npm:@sinclair/typebox/value";

// TODO import from the framework once published
/** Gets the host names of any urls in a record */
export function extractConfigHostNames(
  config: Record<string, string>,
): string[] {
  const hosts = Object.values(config)
    .filter((v) => typeof v === "string")
    .map((v) => {
      try {
        return new URL(v).hostname;
      } catch (_e) {
        return undefined;
      }
    })
    .filter((v) => !!v) as string[]; // Cast should be unnecessary with latest TS versions

  // Make unique
  return [...new Set(hosts)];
}

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
