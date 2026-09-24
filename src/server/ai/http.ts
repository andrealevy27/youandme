import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getViewerFromHeaders, type Viewer } from "../auth/session";
import { AppError, HTTP_STATUS, toFailure, unauthenticated } from "../errors";

/**
 * JSON route wrapper for the search and AI endpoints: resolves the viewer (401 when
 * signed out), maps `AppError` to `{ error }` + status, never leaks stack traces.
 */
export function jsonRoute(handler: (ctx: { req: Request; viewer: Viewer }) => Promise<unknown>) {
  return async (req: Request) => {
    try {
      const viewer = await getViewerFromHeaders(req.headers);
      if (!viewer) throw unauthenticated();
      const result = await handler({ req, viewer });
      return NextResponse.json(result ?? { ok: true }, { headers: { "cache-control": "no-store" } });
    } catch (err) {
      const failure = toFailure(err);
      const status = err instanceof AppError ? HTTP_STATUS[err.code] : err instanceof ZodError ? 400 : 500;
      return NextResponse.json({ error: failure.error, code: failure.code, fieldErrors: failure.fieldErrors }, { status });
    }
  };
}

export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("VALIDATION", "Request body must be valid JSON.");
  }
}
