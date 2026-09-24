import { z } from "zod";
import { REPORT_REASONS, REPORT_TARGETS } from "../../lib/domain";

/** Report input, shared by the service, server action and any future API route. */
export const reportInput = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.string().trim().min(1).max(100),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(2000, "Keep details under 2000 characters.").optional(),
});
export type ReportInput = z.input<typeof reportInput>;

/** Reporting your own profile/message/review is almost always a mistake; startups are shared, so allow it. */
export function isSelfReport(targetType: z.infer<typeof reportInput>["targetType"], ownerId: string | null, reporterId: string) {
  return targetType !== "startup" && ownerId === reporterId;
}
