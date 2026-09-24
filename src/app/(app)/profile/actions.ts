"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import {
  addEducation,
  addExperience,
  educationSchema,
  experienceSchema,
  removeEducation,
  removeExperience,
  setUserIndustries,
  setUserSkills,
  updateHandle,
  updateProfile,
  type ProfilePatch,
} from "@/server/people/profile";
import { removeConnection, requestConnection, respondToConnection } from "@/server/connections";
import { expressInterest } from "@/server/matching/interests";

function revalidateProfile(handle: string) {
  revalidatePath(`/people/${handle}`);
  revalidatePath("/profile/edit");
  revalidatePath("/home");
}

export async function updateProfileAction(patch: ProfilePatch) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await updateProfile(viewer.userId, patch);
    revalidateProfile(viewer.handle);
    return { ok: true };
  });
}

export async function enableCofounderMatchingAction() {
  return runAction(async () => {
    const viewer = await requireViewer();
    const intents = new Set<string>(viewer.roles.includes("founder") ? ["building"] : []);
    intents.add("cofounder");
    await updateProfile(viewer.userId, { lookingForCofounder: true });
    revalidatePath("/matches");
    return { ok: true, intents: [...intents] };
  });
}

export async function setSkillsAction(skillIds: string[]) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const ids = z.array(z.string().uuid()).max(15).parse(skillIds);
    await setUserSkills(viewer.userId, ids, ids.slice(0, 2));
    revalidateProfile(viewer.handle);
    return { ok: true };
  });
}

export async function setIndustriesAction(industryIds: string[]) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await setUserIndustries(viewer.userId, z.array(z.string().uuid()).max(8).parse(industryIds));
    revalidateProfile(viewer.handle);
    return { ok: true };
  });
}

export async function addExperienceAction(input: z.input<typeof experienceSchema>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await addExperience(viewer.userId, input);
    revalidateProfile(viewer.handle);
    return { ok: true };
  });
}

export async function removeExperienceAction(id: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await removeExperience(viewer.userId, z.string().uuid().parse(id));
    revalidateProfile(viewer.handle);
    return { ok: true };
  });
}

export async function addEducationAction(input: z.input<typeof educationSchema>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await addEducation(viewer.userId, input);
    revalidateProfile(viewer.handle);
    return { ok: true };
  });
}

export async function removeEducationAction(id: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await removeEducation(viewer.userId, z.string().uuid().parse(id));
    revalidateProfile(viewer.handle);
    return { ok: true };
  });
}

export async function updateHandleAction(handle: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await updateHandle(viewer.userId, handle);
    revalidatePath("/profile/edit");
    return { ok: true };
  });
}

export async function connectAction(otherId: string, message?: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    return requestConnection(viewer.userId, z.string().min(1).parse(otherId), message);
  });
}

export async function respondConnectionAction(connectionId: string, accept: boolean) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const res = await respondToConnection(viewer.userId, z.string().uuid().parse(connectionId), accept);
    revalidatePath("/home");
    return res;
  });
}

export async function removeConnectionAction(otherId: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await removeConnection(viewer.userId, z.string().min(1).parse(otherId));
    return { ok: true };
  });
}

export async function profileInterestedAction(otherId: string) {
  return runAction(async () => {
    const viewer = await requireViewer();
    return expressInterest(viewer.userId, z.string().min(1).parse(otherId));
  });
}
