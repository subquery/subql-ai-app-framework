import type { IRunner } from "./runners/runner.ts";

export class RunnerHost {
  #runners: Record<string, IRunner> = {};

  constructor(private initRunner: () => IRunner | Promise<IRunner>) {}

  async getRunner(id: string): Promise<IRunner> {
    this.#runners[id] ??= await this.initRunner();

    return this.#runners[id];
  }

  async getAnonymousRunner(): Promise<IRunner> {
    return await this.initRunner();
  }
}
