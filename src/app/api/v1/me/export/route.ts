import { NextResponse } from "next/server";
import { getViewerFromHeaders } from "@/server/auth/session";
import { exportMyData } from "@/server/privacy/account";
import { audit } from "@/server/audit";

export async function GET(req: Request) {
  const viewer = await getViewerFromHeaders(req.headers);
  if (!viewer) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const data = await exportMyData(viewer.userId);
  await audit({ actorId: viewer.userId, action: "account.export", targetType: "user", targetId: viewer.userId });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="youandme-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
