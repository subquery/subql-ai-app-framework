import { AssertError, Value } from "@sinclair/typebox/value";
import ora, { type Ora } from "ora";
import { brightBlue } from "@std/fmt/colors";
import { FromSchema } from "./fromSchema.ts";

export function loadRawConfigFromEnv(
  rawSchema?: unknown,
  envObj?: Record<string, string>,
) {
  if (!rawSchema) return undefined;
  // @ts-ignore functionally works but types are too complex
  const schema = FromSchema(rawSchema);
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

export function getPrompt(
  message = "Enter a message: ",
  defaultValue?: string,
): string {
  const response = prompt(brightBlue(message), defaultValue);

  // null occurs with ctrl+c
  if (response === "/bye" || response === null) {
    Deno.exit(0);
  }

  return response;
}

// Possible sources where projects can be loaded from
export type Source = "local" | "ipfs" | "remote";

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

export function timeout(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}
