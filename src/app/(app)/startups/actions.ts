"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import {
  createNeed,
  createOpenRole,
  createStartup,
  deleteNeed,
  deleteOpenRole,
  deleteStartup,
  inviteMember,
  inviteSchema,
  memberUpdateSchema,
  needInputSchema,
  openRoleSchema,
  removeMember,
  respondToInvite,
  revokeInvite,
  setNeedStatus,
  setOpenRoleOpen,
  updateMember,
  updateStartup,
  type StartupInput,
} from "@/server/startups";

const uuid = z.string().uuid();

function revalidateStartup(slug?: string) {
  revalidatePath("/startup");
  revalidatePath("/home");
  if (slug) {
    revalidatePath(`/startups/${slug}`);
    revalidatePath(`/startups/${slug}/team`);
  }
}

export async function createStartupAction(input: StartupInput) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const s = await createStartup(viewer.userId, input);
    revalidateStartup();
    return { slug: s.slug };
  });
}

export async function updateStartupAction(startupId: string, input: Partial<StartupInput>, slug: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await updateStartup(viewer.userId, uuid.parse(startupId), input);
    revalidateStartup(slug);
    return { ok: true };
  });
}

export async function deleteStartupAction(startupId: string) {
  const res = await runAction(async () => {
    const viewer = await requireViewer();
    await deleteStartup(viewer.userId, uuid.parse(startupId));
  });
  if (res.ok) {
    revalidateStartup();
    redirect("/startup");
  }
  return res;
}

export async function inviteToStartupAction(startupId: string, input: z.input<typeof inviteSchema>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const invite = await inviteMember(viewer.userId, uuid.parse(startupId), input);
    revalidatePath("/startup");
    return { id: invite.id };
  });
}

export async function revokeInviteAction(inviteId: string, slug: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await revokeInvite(viewer.userId, uuid.parse(inviteId));
    revalidateStartup(slug);
    return { ok: true };
  });
}

export async function respondToInviteAction(token: string, accept: boolean) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const res = await respondToInvite(viewer.userId, viewer.email, z.string().min(10).max(100).parse(token), accept);
    revalidateStartup(res.startup.slug);
    return { slug: res.startup.slug, accepted: res.accepted };
  });
}

export async function removeMemberAction(startupId: string, memberUserId: string, slug: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await removeMember(viewer.userId, uuid.parse(startupId), z.string().min(1).parse(memberUserId));
    revalidateStartup(slug);
    return { ok: true };
  });
}

export async function updateMemberAction(startupId: string, memberUserId: string, input: z.input<typeof memberUpdateSchema>, slug: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await updateMember(viewer.userId, uuid.parse(startupId), z.string().min(1).parse(memberUserId), input);
    revalidateStartup(slug);
    return { ok: true };
  });
}

export async function createNeedAction(input: z.input<typeof needInputSchema>, slug?: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const need = await createNeed(viewer.userId, input);
    revalidateStartup(slug);
    revalidatePath("/needs");
    return { id: need.id };
  });
}

export async function setNeedStatusAction(needId: string, status: "open" | "paused" | "fulfilled" | "closed", slug?: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await setNeedStatus(viewer.userId, uuid.parse(needId), status);
    revalidateStartup(slug);
    revalidatePath("/needs");
    return { ok: true };
  });
}

export async function deleteNeedAction(needId: string, slug?: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await deleteNeed(viewer.userId, uuid.parse(needId));
    revalidateStartup(slug);
    revalidatePath("/needs");
    return { ok: true };
  });
}

export async function createOpenRoleAction(startupId: string, input: z.input<typeof openRoleSchema>, slug: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await createOpenRole(viewer.userId, uuid.parse(startupId), input);
    revalidateStartup(slug);
    return { ok: true };
  });
}

export async function setOpenRoleOpenAction(roleId: string, isOpen: boolean, slug: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await setOpenRoleOpen(viewer.userId, uuid.parse(roleId), isOpen);
    revalidateStartup(slug);
    return { ok: true };
  });
}

export async function deleteOpenRoleAction(roleId: string, slug: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await deleteOpenRole(viewer.userId, uuid.parse(roleId));
    revalidateStartup(slug);
    return { ok: true };
  });
}
