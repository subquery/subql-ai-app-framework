import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { ContextType } from "../context/types.ts";
import { loadRawConfigFromEnv } from "../util.ts";

// TODO link this to the types defined in tool
export const FunctionToolType = Type.Object({
  name: Type.String(),
  description: Type.String(),

  parameters: Type.Any(),

  call: Type.Function([Type.Any(), ContextType], Type.Promise(Type.Any())),
  toTool: Type.Function([], Type.Any()),
});

export const VectorConfig = Type.Object({
  path: Type.String({
    description:
      "The path to the db, this can be any uri that lancedb supports as well as an ipfs CID to an archive",
  }),
  type: Type.Literal("lancedb"),
});

export const ProjectManifest = Type.Object({
  specVersion: Type.Literal("0.0.1"),
  model: Type.String({ description: "The Ollama LLM model to be used" }),
  embeddingsModel: Type.Optional(Type.String({
    description: "The Ollama LLM model to be used for vector embeddings",
  })),
  entry: Type.String({
    description: "File path to the project entrypoint",
  }),
  vectorStorage: Type.Optional(Type.Object({
    type: Type.String({
      description:
        "The type of vector storage, currently only lancedb is supported.",
    }),
    path: Type.String({ description: "The path to the db" }),
  })),
  endpoints: Type.Optional(Type.Array(Type.String({
    description: "Allowed endpoints the tools are allowed to make requests to",
  }))),
  config: Type.Optional(Type.Any()), // TODO how can this be a JSON Schema type?
});

export const Project = Type.Object({
  tools: Type.Array(FunctionToolType),
  systemPrompt: Type.String(),
});

export const ProjectEntry = Type.Function(
  [Type.Any()],
  Type.Union([Project, Type.Promise(Project)]),
);

export type FunctionToolType = Static<typeof FunctionToolType>;
export type ProjectManifest = Static<typeof ProjectManifest>;
export type Project = Static<typeof Project>;
export type ProjectEntry = Static<typeof ProjectEntry>;

export async function loadProject(
  manifest: ProjectManifest,
  entry: unknown,
  config?: Record<string, string>,
): Promise<Project> {
  try {
    Value.Assert(ProjectEntry, entry);
  } catch (e) {
    throw new Error("Project entry is invalid", { cause: e });
  }

  const cfg = loadRawConfigFromEnv(manifest.config, config);

  const project = await entry(cfg);
  Value.Assert(Project, project);

  return project;
}
