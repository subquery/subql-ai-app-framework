
import { ISandbox } from "./sandbox.ts";
import { WebWorkerSandbox } from "./webWorker/webWorkerSandbox.ts";

export * from './sandbox.ts';
export * from './mockSandbox.ts';
export * from './unsafeSandbox.ts';

export function getDefaultSandbox(path: string): Promise<ISandbox> {
    // return UnsafeSandbox.create(path);
    return WebWorkerSandbox.create(path);
}

export {
    WebWorkerSandbox
};
