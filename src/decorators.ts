import { getSpinner } from "./util.ts";

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
