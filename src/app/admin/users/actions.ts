"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { ADMIN_ROLES } from "@/lib/domain";
import { banUser, setAdminRole, setUserFeatured, suspendUser, unbanUser, unsuspendUser } from "@/server/admin/users";
import { decideVerification } from "@/server/admin/verification";

const id = z.string().trim().min(1).max(128);
const reason = z.string().trim().min(3, "Add a short reason (it's shared with the member and kept in the audit log).").max(1000);

function revalidateUser(userId: string) {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

const suspendInput = z.object({
  userId: id,
  days: z.enum(["1", "3", "7", "30", "90", "indefinite"]).transform((v) => (v === "indefinite" ? null : Number(v))),
  reason,
});

export async function suspendUserAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("users.moderate");
    const data = suspendInput.parse(raw);
    await suspendUser(viewer, data);
    revalidateUser(data.userId);
  });
}

export async function unsuspendUserAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("users.moderate");
    const { userId } = z.object({ userId: id }).parse(raw);
    await unsuspendUser(viewer, userId);
    revalidateUser(userId);
  });
}

export async function banUserAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("users.moderate");
    const data = z.object({ userId: id, reason }).parse(raw);
    await banUser(viewer, data);
    revalidateUser(data.userId);
  });
}

export async function unbanUserAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("users.moderate");
    const { userId } = z.object({ userId: id }).parse(raw);
    await unbanUser(viewer, userId);
    revalidateUser(userId);
  });
}

export async function setUserFeaturedAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("featured.manage");
    const data = z.object({ userId: id, featured: z.boolean() }).parse(raw);
    await setUserFeatured(viewer, data);
    revalidateUser(data.userId);
  });
}

export async function setAdminRoleAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("admins.manage");
    const data = z
      .object({ userId: id, role: z.enum([...ADMIN_ROLES, "none"]).transform((r) => (r === "none" ? null : r)) })
      .parse(raw);
    await setAdminRole(viewer, data);
    revalidateUser(data.userId);
  });
}

export async function decideUserVerificationAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("verification.review");
    const data = z
      .object({ id, userId: id, decision: z.enum(["verified", "rejected"]), reason: z.string().trim().max(500).optional() })
      .parse(raw);
    await decideVerification(viewer, data);
    revalidateUser(data.userId);
    revalidatePath("/admin/verification");
  });
}
