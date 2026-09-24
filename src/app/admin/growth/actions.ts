"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { audit } from "@/server/audit";
import { getSetting, setSetting } from "@/server/settings";
import { createInvite, inviteFromWaitlist, revokeInvite } from "@/server/admin/growth";

const id = z.string().trim().min(1).max(128);

function revalidate() {
  revalidatePath("/admin/growth");
}

export async function inviteWaitlistEntryAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("waitlist.manage");
    const data = z.object({ id }).parse(raw);
    const invite = await inviteFromWaitlist(viewer, data.id);
    revalidate();
    return { code: invite.code };
  });
}

const createInviteInput = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,32}$/, "Codes are 4–32 letters, numbers or dashes.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  email: z.string().trim().email("Enter a valid email or leave it blank.").max(320).optional().or(z.literal("").transform(() => undefined)),
  note: z.string().trim().max(200).optional(),
  maxUses: z.coerce.number().int().min(1, "At least one use.").max(10_000),
  expiresInDays: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(365)])
    .optional()
    .transform((v) => (typeof v === "number" ? v : null)),
});

export async function createInviteAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("invites.manage");
    const data = createInviteInput.parse(raw);
    const invite = await createInvite(viewer, data);
    revalidate();
    return { code: invite.code };
  });
}

export async function revokeInviteAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("invites.manage");
    const data = z.object({ id }).parse(raw);
    await revokeInvite(viewer, data.id);
    revalidate();
  });
}

/** invite_only is gated by invites.manage, waitlist_enabled by waitlist.manage. */
export async function setGrowthToggleAction(raw: unknown) {
  return runAction(async () => {
    const data = z.object({ key: z.enum(["invite_only", "waitlist_enabled"]), value: z.boolean() }).parse(raw);
    const viewer = await requireAdmin(data.key === "invite_only" ? "invites.manage" : "waitlist.manage");
    const before = await getSetting(data.key);
    await setSetting(data.key, data.value, viewer.userId);
    await audit({ actorId: viewer.userId, action: "settings.updated", targetType: "setting", targetId: data.key, metadata: { before, after: data.value } });
    revalidate();
  });
}
