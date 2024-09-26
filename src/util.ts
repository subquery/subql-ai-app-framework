import { type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import ora, { Ora } from "ora";

export function loadConfigFromEnv<T extends TSchema>(
  schema?: T,
): Static<T> | undefined {
  if (!schema) return undefined;
  const envObj = Deno.env.toObject();
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
