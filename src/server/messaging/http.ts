import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getViewerFromHeaders, type Viewer } from "../auth/session";
import { AppError, HTTP_STATUS, toFailure, unauthenticated } from "../errors";

/**
 * Wrapper for mobile-ready JSON route handlers: resolves the viewer (401 when signed out),
 * maps `AppError` to `{ error }` + the right status and never leaks stack traces.
 */
export function apiRoute<P = Record<string, never>>(
  handler: (ctx: { req: Request; viewer: Viewer; params: P }) => Promise<unknown>,
) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      const viewer = await getViewerFromHeaders(req.headers);
      if (!viewer) throw unauthenticated();
      const params = ctx?.params ? await ctx.params : ({} as P);
      const result = await handler({ req, viewer, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { headers: { "cache-control": "no-store" } });
    } catch (err) {
      const failure = toFailure(err);
      const status = err instanceof AppError ? HTTP_STATUS[err.code] : err instanceof ZodError ? 400 : 500;
      return NextResponse.json({ error: failure.error, code: failure.code, fieldErrors: failure.fieldErrors }, { status });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("VALIDATION", "Request body must be valid JSON.");
  }
}
