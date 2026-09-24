export type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string };
