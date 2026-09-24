import { NextResponse, type NextRequest } from "next/server";
import { getViewerFromHeaders } from "@/server/auth/session";
import { AppError, HTTP_STATUS, toFailure } from "@/server/errors";
import { searchConsultants, type ConsultantSearchInput } from "@/server/consultants";

/**
 * GET /api/v1/consultants — marketplace search for mobile clients.
 * Query: need, q, category, industry, maxPrice (cents), minRating, stage, language,
 * remote=1, availableThisWeek=1, sort (relevance|rating|price_low|price_high), page, limit (≤ 24).
 */
export async function GET(req: NextRequest) {
  const viewer = await getViewerFromHeaders(req.headers);
  if (!viewer) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  // Every field is coerced and validated by `consultantSearchInput` (zod) inside the service.
  const params = Object.fromEntries(req.nextUrl.searchParams.entries()) as ConsultantSearchInput;
  try {
    const result = await searchConsultants(viewer.userId, params);
    return NextResponse.json(result);
  } catch (err) {
    const f = toFailure(err);
    return NextResponse.json({ error: f.error }, { status: err instanceof AppError ? HTTP_STATUS[err.code] : f.code === "VALIDATION" ? 400 : 500 });
  }
}
