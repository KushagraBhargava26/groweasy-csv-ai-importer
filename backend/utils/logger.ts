// A tiny, dependency-free logger. Purpose: consistent, timestamped output
// across every service, and a single place to later swap in something
// heavier (pino, winston) without touching every file that logs something.
// We're not pulling in a logging library yet — for this project's scope,
// console-based logging with structure is enough, and it keeps the
// dependency list honest (only add a package when you actually need its features).

type LogLevel = "info" | "warn" | "error" | "debug";

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (meta) {
    console.log(prefix, message, JSON.stringify(meta));
  } else {
    console.log(prefix, message);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
};