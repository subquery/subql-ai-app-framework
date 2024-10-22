import type { Level, Logger } from "pino";

let rootLogger: Logger;
const childLoggers: Record<string, Logger> = {};

export async function initLogger(
  format: "json" | "pretty" = "json",
  level: Level = "info",
) {
  if (rootLogger) return;

  const { pino } = await import("pino");
  const { default: pretty } = await import("pino-pretty");

  rootLogger = pino(
    format === "pretty"
      ? pretty({
        colorize: true,
        ignore: "pid,hostname",
      })
      : undefined,
  );
  rootLogger.level = level;
}

export async function getLogger(scope: string): Promise<Logger> {
  await initLogger();
  // `name` works with pino-pretty
  childLoggers[scope] ??= rootLogger.child({ name: scope });
  return childLoggers[scope];
}

export async function setLogLevel(level: Level): Promise<void> {
  await initLogger();
  rootLogger.level = level;
  Object.values(childLoggers).map((l) => l.level = level);
}
