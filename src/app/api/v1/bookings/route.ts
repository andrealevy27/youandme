import { NextResponse, type NextRequest } from "next/server";
import { getViewerFromHeaders } from "@/server/auth/session";
import { AppError, HTTP_STATUS, toFailure } from "@/server/errors";
import { BOOKING_TABS, listBookingsForUser, type BookingTab } from "@/server/bookings";

/** GET /api/v1/bookings?tab=upcoming|past|cancelled&role=client|consultant&limit=50 */
export async function GET(req: NextRequest) {
  const viewer = await getViewerFromHeaders(req.headers);
  if (!viewer) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const tab = (BOOKING_TABS as readonly string[]).includes(p.get("tab") ?? "") ? (p.get("tab") as BookingTab) : "upcoming";
  const role = p.get("role") === "client" || p.get("role") === "consultant" ? (p.get("role") as "client" | "consultant") : undefined;
  const limit = Math.min(100, Math.max(1, Number(p.get("limit")) || 50));
  try {
    const bookings = await listBookingsForUser(viewer.userId, tab, { role, limit });
    return NextResponse.json({ bookings });
  } catch (err) {
    const f = toFailure(err);
    return NextResponse.json({ error: f.error }, { status: err instanceof AppError ? HTTP_STATUS[err.code] : 500 });
  }
}
