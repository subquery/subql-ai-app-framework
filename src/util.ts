import type { Static, TSchema } from "@sinclair/typebox";
import { AssertError, Value } from "@sinclair/typebox/value";
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

// Possible sources where projects can be loaded from
export type ProjectSource = "local" | "ipfs";

export function PrettyTypeboxError(
  error: Error,
  prefix = "Type Assertion Failed",
): Error {
  if (
    error instanceof AssertError || error.constructor.name === "AssertError"
  ) {
    const errs = [...(error as AssertError).Errors()];

    let msg = `${prefix}:\n`;
    for (const e of errs) {
      msg += `\t${e.path}: ${e.message}\n`;
    }
    return new Error(msg, { cause: error });
  }

  return error;
}
