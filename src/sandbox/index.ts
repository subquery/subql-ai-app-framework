import type { ProjectSource } from "../util.ts";
import type { ISandbox } from "./sandbox.ts";
import {
  type Permissions,
  WebWorkerSandbox,
} from "./webWorker/webWorkerSandbox.ts";

export * from "./sandbox.ts";
export * from "./mockSandbox.ts";
export * from "./unsafeSandbox.ts";

const IPFS_PERMISSIONS: Permissions = {
  allowRead: false,
  allowFFI: false,
};

const LOCAL_PERMISSIONS: Permissions = {
  allowRead: true,
  allowFFI: true,
};

function getPermisionsForSource(source: ProjectSource): Permissions {
  switch (source) {
    case "local":
      return LOCAL_PERMISSIONS;
    case "ipfs":
      return IPFS_PERMISSIONS;
    default:
      throw new Error(
        `Unable to set permissions for unknown source: ${source}`,
      );
  }
}

export function getDefaultSandbox(
  path: string,
  source: ProjectSource,
): Promise<ISandbox> {
  // return UnsafeSandbox.create(path);
  const permissions = getPermisionsForSource(source);
  return WebWorkerSandbox.create(path, permissions);
}

export { WebWorkerSandbox };
