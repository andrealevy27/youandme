"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { actionReport, dismissReport, markReportReviewing, removeReportedContent } from "@/server/admin/reports";

const id = z.string().trim().min(1).max(128);
const resolution = z.string().trim().min(3, "Add a resolution note for the audit trail.").max(2000);

function revalidate() {
  revalidatePath("/admin", "layout");
}

export async function markReportReviewingAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("reports.handle");
    const data = z.object({ id }).parse(raw);
    await markReportReviewing(viewer, data.id);
    revalidate();
  });
}

export async function dismissReportAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("reports.handle");
    const data = z.object({ id, note: z.string().trim().max(2000).optional() }).parse(raw);
    await dismissReport(viewer, data);
    revalidate();
  });
}

export async function actionReportAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("reports.handle");
    const data = z.object({ id, resolution }).parse(raw);
    await actionReport(viewer, data);
    revalidate();
  });
}

export async function removeReportedContentAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("reports.handle");
    const data = z.object({ id, resolution }).parse(raw);
    await removeReportedContent(viewer, data);
    revalidate();
  });
}
