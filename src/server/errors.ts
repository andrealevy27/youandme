import { ZodError } from "zod";
import { logger } from "./logger";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

/** Errors whose `message` is safe to show to users. Anything else is logged and replaced. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "That page") => new AppError("NOT_FOUND", `${what} could not be found.`);
export const forbidden = (message = "You don't have access to do that.") => new AppError("FORBIDDEN", message);
export const unauthenticated = () => new AppError("UNAUTHENTICATED", "Please sign in to continue.");

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: ErrorCode; fieldErrors?: Record<string, string[]> };

export const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
};

/** Convert any thrown value to a user-safe failure result, logging technical details server-side. */
export function toFailure(err: unknown, fallback = "Something went wrong. Please try again."): Extract<ActionResult, { ok: false }> {
  if (err instanceof AppError) return { ok: false, error: err.message, code: err.code };
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, error: err.issues[0]?.message ?? "Please check the highlighted fields.", code: "VALIDATION", fieldErrors };
  }
  // Next.js uses thrown errors for redirect()/notFound(); let them propagate.
  if (err && typeof err === "object" && "digest" in err && typeof (err as { digest: unknown }).digest === "string") {
    const digest = (err as { digest: string }).digest;
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND") throw err;
  }
  logger.error("unhandled_error", { err });
  return { ok: false, error: fallback };
}

/** Wrap server-action bodies: consistent result shape, no leaked stack traces. */
export async function runAction<T>(fn: () => Promise<T>, fallback?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return toFailure(err, fallback);
  }
}
