import { NextResponse, type NextRequest } from "next/server";
import { getViewerFromHeaders } from "@/server/auth/session";
import { AppError, HTTP_STATUS, toFailure } from "@/server/errors";
import { env } from "@/server/env";
import { getBookingIcs } from "@/server/bookings";

/** GET /api/v1/bookings/:id/ics — calendar file for a confirmed booking (participants only). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewerFromHeaders(req.headers);
  if (!viewer) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "That booking could not be found." }, { status: 404 });
  try {
    const ics = await getBookingIcs(viewer.userId, id, env.NEXT_PUBLIC_APP_URL);
    return new NextResponse(ics, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="youandme-booking-${id.slice(0, 8)}.ics"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (err) {
    const f = toFailure(err);
    return NextResponse.json({ error: f.error }, { status: err instanceof AppError ? HTTP_STATUS[err.code] : 500 });
  }
}
