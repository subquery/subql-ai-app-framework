import {
  type Static,
  TFunction,
  type TObject,
  TPromise,
  type TSchema,
  TUndefined,
  TUnion,
  Type,
} from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { loadConfigFromEnv } from "../util.ts";
import { ContextType } from "../context/context.ts";

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

export const Project = Type.Object({
  model: Type.String({
    description: "The llm model to use",
  }),
  embedModel: Type.Optional(Type.String({
    description: "The model used to generate embeddings queries",
  })),
  systemPrompt: Type.String({
    description: "The initial system prompt of the app",
  }),
  userMessage: Type.Optional(Type.String({
    description: "An initial message to present to the user",
  })),
  tools: Type.Array(FunctionToolType),
  vectorStorage: Type.Optional(VectorConfig),
});

export type IFunctionTool = Static<typeof FunctionToolType>;
export type IVectorConfig = Static<typeof VectorConfig>;

type IProjectEntry<Config extends TObject> = TUnion<[
  TObject<
    {
      configType: TSchema;
      projectFactory: TFunction<[Config], TPromise<typeof Project>>;
    }
  >,
  TObject<
    {
      configType: TUndefined;
      projectFactory: TFunction<[], TPromise<typeof Project>>;
    }
  >,
]>;

export type IProject = Static<typeof Project>;
export type IProjectEntrypoint<T extends TObject = TObject> = Static<
  IProjectEntry<T>
>;

export function validateProject(project: any): void {
  return Value.Assert(Project, project);
}

function validateProjectEntry(entry: any): void {
  const projectType = ProjectEntrypointGen(entry?.configType);

  Value.Assert(projectType, entry);
}

const ProjectEntrypointGen = <T extends TObject>(t: T) =>
  Type.Union([
    Type.Object({
      configType: Type.Any(),
      projectFactory: Type.Function([t], Type.Promise(Project)),
    }),
    Type.Object({
      // configType: Type.Undefined(),
      projectFactory: Type.Function([], Type.Promise(Project)),
    }),
  ]);

export async function getProjectFromEntrypoint(
  entrypoint: any,
): Promise<IProject> {
  if (!entrypoint) {
    throw new Error("Project entry is invalid");
  }
  // Validate the entrypoint
  validateProjectEntry(entrypoint);

  const config = loadConfigFromEnv(entrypoint.configType);

  // Check that the constructed project is valid
  const project = await entrypoint.projectFactory(config);

  validateProject(project);

  return project;
}
