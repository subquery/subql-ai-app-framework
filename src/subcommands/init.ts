import { resolve } from "@std/path/resolve";
import README from "./init/readme.ts";
import GITIGNORE from "./init/gitignore.ts";
import DOCKER_COMPOSE from "./init/docker-compose.ts";

type Options = {
  name: string;
  model: string;
};

const manifestTemplate = (model: string): string => {
  return `import type { ProjectManifest } from "jsr:@subql/ai-app-framework";
import { ConfigType } from "./project.ts";

const project: ProjectManifest = {
  specVersion: "0.0.1",
  // Specify any hostnames your tools will make network requests too
  endpoints: [],

  // If you wish to add RAG data to your project you can reference the DB here
  // vectorStorage: {
  // type: "lancedb",
  //   path: "./db",
  // },
  // Set this to the same model you use to generate your RAG db
  // embeddingsModel: "nomic-embed-text",

  // Your projects runtime configuration options
  config: JSON.parse(JSON.stringify(ConfigType)), // Convert to JSON Schema
  model: "${model}",
  entry: "./project.ts",
};

export default project;`;
};

const projectTemplate = (): string => {
  return `import { type Static, Type } from "npm:@sinclair/typebox";
import { type Project, type ProjectEntry, FunctionTool } from "jsr:@subql/ai-app-framework";

export const ConfigType = Type.Object({
  EXAMPLE_ENDPOINT: Type.String({
    default: 'https://example.com',
    description: 'This is an example config option',
  }),
});

export type Config = Static<typeof ConfigType>;

class GreetingTool extends FunctionTool {

  description = \`This tool responds with a welcome greeting when the user shares their name.\`;

  parameters = {
    type: "object",
    required: ["name"],
    properties: {
      name: {
        type: "string",
        description:
          "The name of the user",
      },
    },
  };

  async call({ name }: { name: string }): Promise<string | null> {
    return \`Hello ${name}, nice to meet you\`;
  }
}

// deno-lint-ignore require-await
const entrypoint: ProjectEntry = async (config: Config): Promise<Project> => {
  return {
    tools: [
      new GreetingTool(),
    ],
    systemPrompt: \`You are an agent designed to greet a user.
    Given an input name, use the available greeting tools to provide a personalised greeting back.
    You answer must use the result of the tools available.
    Do not mention that you used a tool or the name of a tool.
    If you need more information to answer the question, ask the user for more details.\`,
  };
};

export default entrypoint;`;
};

export async function initProject(opts: Options): Promise<void> {
  const dir = resolve(Deno.cwd(), opts.name);

  try {
    await Deno.mkdir(dir);
  } catch (e) {
    if (!(e instanceof Deno.errors.AlreadyExists)) {
      throw e;
    }
    throw new Error(`A directory with the name ${opts.name} already exists`);
  }

  await Deno.writeTextFile(
    resolve(dir, "manifest.ts"),
    manifestTemplate(opts.model),
  );
  await Deno.writeTextFile(resolve(dir, "project.ts"), projectTemplate());
  await Deno.writeTextFile(resolve(dir, "README.md"), README);
  await Deno.writeTextFile(resolve(dir, ".gitignore"), GITIGNORE);
  await Deno.writeTextFile(resolve(dir, "docker-compose.yml"), DOCKER_COMPOSE);
}
