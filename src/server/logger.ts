/** Structured server logger. Swap the sink for Datadog/Sentry/etc. without touching callers. */
type Level = "debug" | "info" | "warn" | "error";

function serialize(meta?: Record<string, unknown>) {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v;
  }
  return out;
}

function log(level: Level, event: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...serialize(meta) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (e: string, m?: Record<string, unknown>) => log("debug", e, m),
  info: (e: string, m?: Record<string, unknown>) => log("info", e, m),
  warn: (e: string, m?: Record<string, unknown>) => log("warn", e, m),
  error: (e: string, m?: Record<string, unknown>) => log("error", e, m),
};
