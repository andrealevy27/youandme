import { and, desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { cofounderTrials, matches, profiles } from "../db/schema";
import { AppError, forbidden } from "../errors";
import { track } from "../analytics";
import { notify } from "../notifications";
import { addSystemMessage } from "../messaging";

export const TRIAL_DAYS = 14;

/** The key conversations every cofounder pair should have early. */
export const TRIAL_CHECKLIST = [
  { key: "roles", title: "Roles", prompt: "Who owns what — product, tech, customers, fundraising? Who breaks a tie?" },
  { key: "time", title: "Time commitment", prompt: "Hours per week now, during finals, this summer, and after graduation." },
  { key: "equity", title: "Equity", prompt: "How you'd split it, and vesting (e.g. 4 years with a 1-year cliff)." },
  { key: "first_build", title: "What you build first", prompt: "The first thing you'll ship, and how you'll know it's working." },
  { key: "ip", title: "Ownership", prompt: "Who owns the code and the idea if one of you leaves." },
  { key: "exit", title: "If it doesn't work", prompt: "How either of you can step away, kindly and cleanly." },
] as const;
export type ChecklistKey = (typeof TRIAL_CHECKLIST)[number]["key"];

export type TrialOutcome = "active" | "check_in" | "continuing" | "stopped";

type Trial = typeof cofounderTrials.$inferSelect;

function side(trial: Trial, userId: string): "a" | "b" {
  if (trial.userAId === userId) return "a";
  if (trial.userBId === userId) return "b";
  throw forbidden("This isn't your trial.");
}

/** Derived, never stored: both said continue → continuing; anyone said stop → stopped. */
export function trialOutcome(t: Pick<Trial, "decisionA" | "decisionB" | "endsAt">, now = new Date()): TrialOutcome {
  if (t.decisionA === "stop" || t.decisionB === "stop") return "stopped";
  if (t.decisionA === "continue" && t.decisionB === "continue") return "continuing";
  return now >= t.endsAt ? "check_in" : "active";
}

export function daysLeft(t: Pick<Trial, "endsAt">, now = new Date()) {
  return Math.max(0, Math.ceil((t.endsAt.getTime() - now.getTime()) / 86_400_000));
}

async function activeMatchFor(userId: string, matchId: string) {
  const [m] = await db.select().from(matches).where(and(eq(matches.id, matchId), isNull(matches.unmatchedAt))).limit(1);
  if (!m || (m.userAId !== userId && m.userBId !== userId)) throw new AppError("NOT_FOUND", "Match not found.");
  return m;
}

async function nameOf(userId: string) {
  const [p] = await db.select({ name: profiles.displayName }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return p?.name.split(" ")[0] ?? "Your match";
}

export async function getTrialForMatch(userId: string, matchId: string) {
  await activeMatchFor(userId, matchId);
  const [t] = await db.select().from(cofounderTrials).where(eq(cofounderTrials.matchId, matchId)).orderBy(desc(cofounderTrials.startedAt)).limit(1);
  return t ?? null;
}

export async function startTrial(userId: string, matchId: string, now = new Date()) {
  const m = await activeMatchFor(userId, matchId);
  const existing = await getTrialForMatch(userId, matchId);
  if (existing && !existing.closedAt) return existing;
  const [trial] = await db
    .insert(cofounderTrials)
    .values({ matchId, userAId: m.userAId, userBId: m.userBId, startedBy: userId, startedAt: now, endsAt: new Date(now.getTime() + TRIAL_DAYS * 86_400_000) })
    .returning();
  const other = m.userAId === userId ? m.userBId : m.userAId;
  const me = await nameOf(userId);
  if (m.conversationId) {
    await addSystemMessage(m.conversationId, `${me} started a 2-week cofounder trial. Work through the checklist together, then check in.`);
  }
  await notify({ userId: other, type: "new_match", title: `${me} started a 2-week cofounder trial with you`, body: "Six conversations to have, then a check-in.", href: `/trials/${trial!.id}`, actorId: userId });
  track("trial_started", userId, { matchId });
  return trial!;
}

export async function getTrial(userId: string, trialId: string) {
  const [t] = await db.select().from(cofounderTrials).where(eq(cofounderTrials.id, trialId)).limit(1);
  if (!t) throw new AppError("NOT_FOUND", "Trial not found.");
  side(t, userId);
  return t;
}

const itemSchema = z.enum(TRIAL_CHECKLIST.map((c) => c.key) as [ChecklistKey, ...ChecklistKey[]]);

export async function setChecklistItem(userId: string, trialId: string, rawKey: string, done: boolean) {
  const key = itemSchema.parse(rawKey);
  const t = await getTrial(userId, trialId);
  if (t.closedAt) throw new AppError("VALIDATION", "This trial has ended.");
  const checklist = { ...t.checklist };
  if (done) checklist[key] = new Date().toISOString();
  else delete checklist[key];
  await db.update(cofounderTrials).set({ checklist }).where(eq(cofounderTrials.id, trialId));
  return checklist;
}

/** Either person can check in at any time; the trial closes once both have, or as soon as someone stops. */
export async function checkIn(userId: string, trialId: string, raw: "continue" | "stop") {
  const decision = z.enum(["continue", "stop"]).parse(raw);
  const t = await getTrial(userId, trialId);
  if (t.closedAt) throw new AppError("VALIDATION", "This trial has already ended.");
  const s = side(t, userId);
  const patch = s === "a" ? { decisionA: decision } : { decisionB: decision };
  const next = { ...t, ...patch };
  const outcome = trialOutcome(next);
  const closed = outcome === "continuing" || outcome === "stopped";
  await db
    .update(cofounderTrials)
    .set({ ...patch, closedAt: closed ? new Date() : null })
    .where(eq(cofounderTrials.id, trialId));
  const other = s === "a" ? t.userBId : t.userAId;
  const me = await nameOf(userId);
  if (closed) {
    await notify({
      userId: other,
      type: "new_match",
      title: outcome === "continuing" ? `You and ${me} are continuing as cofounders` : `${me} has ended your cofounder trial`,
      body: outcome === "continuing" ? "Both of you said continue. Good luck building." : "Thanks for giving it a real try.",
      href: `/trials/${trialId}`,
      actorId: userId,
    });
  } else {
    await notify({ userId: other, type: "new_match", title: `${me} checked in on your cofounder trial`, body: "Add your check-in when you're ready.", href: `/trials/${trialId}`, actorId: userId });
  }
  track("trial_check_in", userId, { decision });
  return { outcome };
}

export async function listMyTrials(userId: string) {
  return db
    .select()
    .from(cofounderTrials)
    .where(or(eq(cofounderTrials.userAId, userId), eq(cofounderTrials.userBId, userId)))
    .orderBy(desc(cofounderTrials.startedAt));
}
