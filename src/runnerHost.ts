import { Runner } from "./runner.ts";

export class RunnerHost {
  #runners: Record<string, Runner> = {};

  constructor(private initRunner: () => Promise<Runner>) {}

  async getRunner(id: string): Promise<Runner> {
    this.#runners[id] ??= await this.initRunner();

    return this.#runners[id];
  }
}
