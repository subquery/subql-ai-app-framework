import type { Loader } from "../loader.ts";
import type { ISandbox } from "./sandbox.ts";
// import { UnsafeSandbox } from "./unsafeSandbox.ts";
import { WebWorkerSandbox } from "./webWorker/webWorkerSandbox.ts";

export * from "./sandbox.ts";
export * from "./mockSandbox.ts";
export * from "./unsafeSandbox.ts";

export function getDefaultSandbox(
  loader: Loader,
  timeout: number
): Promise<ISandbox> {
  // return UnsafeSandbox.create(loader);
  return WebWorkerSandbox.create(loader, timeout);
}

export { WebWorkerSandbox };
