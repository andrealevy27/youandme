"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import {
  addPortfolioItem,
  addTimeOff,
  becomeConsultant,
  removePortfolioItem,
  removeTimeOff,
  setAvailability,
  setServiceActive,
  updateConsultantProfile,
  updateScheduling,
  upsertService,
  type availabilityInput,
  type consultantProfileInput,
  type portfolioInput,
  type schedulingInput,
  type serviceInput,
  type timeOffInput,
} from "@/server/consultants";
import { getPayoutDashboardLink, getPayoutStatus, startConnectOnboarding } from "@/server/payments";

function refresh() {
  revalidatePath("/consultant");
}

export async function applyAsConsultantAction(raw: z.input<typeof consultantProfileInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await becomeConsultant(viewer.userId, raw);
    refresh();
  });
}

export async function updateConsultantProfileAction(raw: z.input<typeof consultantProfileInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await updateConsultantProfile(viewer.userId, raw);
    refresh();
    revalidatePath(`/consultants/${viewer.handle}`);
  });
}

export async function upsertServiceAction(raw: z.input<typeof serviceInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const s = await upsertService(viewer.userId, raw);
    refresh();
    return { id: s.id };
  });
}

const serviceActive = z.object({ serviceId: z.string().uuid(), active: z.boolean() });
export async function setServiceActiveAction(raw: z.input<typeof serviceActive>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const { serviceId, active } = serviceActive.parse(raw);
    await setServiceActive(viewer.userId, serviceId, active);
    refresh();
  });
}

export async function setAvailabilityAction(raw: z.input<typeof availabilityInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await setAvailability(viewer.userId, raw);
    refresh();
  });
}

export async function updateSchedulingAction(raw: z.input<typeof schedulingInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await updateScheduling(viewer.userId, raw);
    refresh();
  });
}

export async function addTimeOffAction(raw: z.input<typeof timeOffInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await addTimeOff(viewer.userId, raw);
    refresh();
  });
}

const idInput = z.object({ id: z.string().uuid() });
export async function removeTimeOffAction(raw: z.input<typeof idInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await removeTimeOff(viewer.userId, idInput.parse(raw).id);
    refresh();
  });
}

export async function addPortfolioAction(raw: z.input<typeof portfolioInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await addPortfolioItem(viewer.userId, raw);
    refresh();
  });
}

export async function removePortfolioAction(raw: z.input<typeof idInput>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await removePortfolioItem(viewer.userId, idInput.parse(raw).id);
    refresh();
  });
}

export async function connectPayoutsAction() {
  return runAction(async () => {
    const viewer = await requireViewer();
    return { url: await startConnectOnboarding(viewer.userId) };
  });
}

export async function payoutDashboardAction() {
  return runAction(async () => {
    const viewer = await requireViewer();
    return { url: await getPayoutDashboardLink(viewer.userId) };
  });
}

export async function refreshPayoutStatusAction() {
  return runAction(async () => {
    const viewer = await requireViewer();
    const status = await getPayoutStatus(viewer.userId, { refresh: true });
    refresh();
    return status;
  });
}
