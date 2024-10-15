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

export function getPrompt(): string | null {
  const response = prompt(brightBlue(`Enter a message: `));

  if (response === "/bye") {
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

export function SpinnerLog(
  messages: { start: string; success: string; fail: string },
) {
  // deno-lint-ignore no-explicit-any
  return function (fn: any, _ctx: ClassMethodDecoratorContext) {
    return async function (...args: unknown[]) {
      const spinner = getSpinner().start(messages.start);
      try {
        const v = await fn.apply(this, ...args);
        spinner.succeed(messages.success);
        return v;
      } catch (e) {
        spinner.fail(messages.fail);
        throw e;
      }
    };
  };
}
