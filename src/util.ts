import type { Static, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import ora, { type Ora } from "ora";
import { brightBlue } from "@std/fmt/colors";

export function loadConfigFromEnv<T extends TSchema>(
  schema?: T,
  envObj?: Record<string, string>,
): Static<T> | undefined {
  if (!schema) return undefined;
  envObj ??= Deno.env.toObject();
  return Value.Parse(schema, envObj);
}

// A global spinner, this allows for easily setting isSilent
let spinner = ora();

export function getSpinner(): Ora {
  return spinner;
}

export function setSpinner(ora: Ora) {
  spinner = ora;
}

export function getPrompt(): string | null {
  const response = prompt(brightBlue(`Enter a message: `));

  if (response === "/bye") {
    Deno.exit(0);
  }

  return response;
}
