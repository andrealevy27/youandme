import { requireAdmin } from "@/server/auth/session";
import { AppError, HTTP_STATUS } from "@/server/errors";
import { exportWaitlist } from "@/server/admin/growth";
import { toCsv } from "@/server/admin/utils";

/** Admin download of the whole waitlist, e.g. for a launch announcement. */
export async function GET() {
  try {
    await requireAdmin("waitlist.manage");
  } catch (err) {
    if (err instanceof AppError) return Response.json({ error: err.message }, { status: HTTP_STATUS[err.code] });
    throw err;
  }
  const rows = await exportWaitlist();
  const csv = toCsv([
    ["email", "name", "intent", "note", "status", "invite_code", "joined_at"],
    ...rows.map((r) => [r.email, r.name, r.intent, r.note, r.status, r.inviteCode, r.createdAt.toISOString()]),
  ]);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="youandme-waitlist-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
