import type { Logger } from "pino";
import { getSpinner } from "./util.ts";
import process from "node:process";

/** Creates a logging spinner using Ora for progress on a function */
export function SpinnerLog(
  messages: { start: string; success: string; fail: string },
) {
  // deno-lint-ignore no-explicit-any
  return function (fn: any, _ctx: ClassMethodDecoratorContext) {
    return function (...args: unknown[]) {
      const spinner = getSpinner().start(messages.start);
      try {
        // @ts-ignore need to apply this function call but unable to type "this"
        const v = fn.apply(this, ...args);

        if (v instanceof Promise) {
          return v.then((r) => {
            spinner.succeed(messages.success);
            return r;
          });
        }
        spinner.succeed(messages.success);
        return v;
      } catch (e) {
        spinner.fail(messages.fail);
        throw e;
      }
    };
  };
}

export function Memoize() {
  const cache = new Map<string, unknown>();

  // deno-lint-ignore no-explicit-any
  return function (fn: any, _ctx: ClassMethodDecoratorContext) {
    return function (...args: unknown[]) {
      const key = JSON.stringify(args);

      if (cache.has(key)) {
        return cache.get(key);
      }

      // @ts-ignore need to apply this function call but unable to type "this"
      const result = fn.apply(this, args);

      // If the method is async, wait for the promise to resolve
      if (result instanceof Promise) {
        return result.then((resolvedResult) => {
          cache.set(key, resolvedResult);
          return resolvedResult;
        });
      }

      cache.set(key, result);
      return result;
    };
  };
}

/**
 * A debug logger that logs the function name and MS it took for the function to run
 * @param logger The logger to run the output
 * @param overrideName (Optional) Override the name of the function used in the log
 * @returns
 */
export function LogPerformance(logger: Logger, overrideName?: string) {
  const logTime = (name: string | symbol, start: [number, number]) => {
    const [seconds, nanoseconds] = process.hrtime(start); // Get high-resolution elapsed time
    const elapsedTimeInMs = (seconds * 1e9 + nanoseconds) / 1e6;
    logger.debug(`${overrideName ?? name.toString()}: ${elapsedTimeInMs}ms`);
  };

  // deno-lint-ignore no-explicit-any
  return function (fn: any, ctx: ClassMethodDecoratorContext) {
    return function (...args: unknown[]) {
      const start = process.hrtime();

      // @ts-ignore need to apply this function call but unable to type "this"
      const result = fn.apply(this, args);

      // If the method is async, wait for the promise to resolve
      if (result instanceof Promise) {
        return result.then((resolvedResult) => {
          logTime(ctx.name, start);
          return resolvedResult;
        });
      }

      logTime(ctx.name, start);
      return result;
    };
  };
}
