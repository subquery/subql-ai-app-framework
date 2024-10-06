import { Runner } from "./runner.ts";

export class RunnerHost {
  #runners: Record<string, Runner> = {};

  constructor(private initRunner: () => Runner | Promise<Runner>) {}

  async getRunner(id: string): Promise<Runner> {
    this.#runners[id] ??= await this.initRunner();

    return this.#runners[id];
  }

  async getAnonymousRunner(): Promise<Runner> {
    return await this.initRunner();
  }
}
