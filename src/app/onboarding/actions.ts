"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { db } from "@/server/db";
import { needs, userIndustries } from "@/server/db/schema";
import { track } from "@/server/analytics";
import {
  completeOnboarding,
  setOnboardingStep,
  setUserIndustries,
  setUserSkills,
  updateProfile,
  profilePatchSchema,
} from "@/server/people/profile";
import { createNeed, createStartup, getPrimaryStartup, updateStartup } from "@/server/startups";
import { STARTUP_STAGES } from "@/lib/domain";

const stepSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("profile"), index: z.number().int(), patch: profilePatchSchema }),
  z.object({ step: z.literal("skills"), index: z.number().int(), skillIds: z.array(z.string().uuid()).max(15) }),
  z.object({ step: z.literal("industries"), index: z.number().int(), industryIds: z.array(z.string().uuid()).max(8) }),
  z.object({
    step: z.literal("startup"),
    index: z.number().int(),
    startup: z.object({
      name: z.string().trim().min(1).max(80),
      tagline: z.string().trim().max(140).optional(),
      stage: z.enum(STARTUP_STAGES),
      teamSize: z.number().int().min(1).max(1000).optional(),
    }),
  }),
  z.object({ step: z.literal("missing_skills"), index: z.number().int(), skillIds: z.array(z.string().uuid()).max(10) }),
  z.object({ step: z.literal("help"), index: z.number().int(), categoryIds: z.array(z.string().uuid()).max(10) }),
  z.object({ step: z.literal("progress"), index: z.number().int() }),
]);

export type OnboardingStepInput = z.input<typeof stepSchema>;

export async function saveOnboardingStep(raw: OnboardingStepInput) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const input = stepSchema.parse(raw);
    const uid = viewer.userId;
    switch (input.step) {
      case "profile":
        await updateProfile(uid, input.patch);
        break;
      case "skills":
        await setUserSkills(uid, input.skillIds, input.skillIds.slice(0, 2));
        break;
      case "industries":
        await setUserIndustries(uid, input.industryIds);
        break;
      case "startup": {
        const existing = await getPrimaryStartup(uid);
        const industryRows = await db.select({ id: userIndustries.industryId }).from(userIndustries).where(eq(userIndustries.userId, uid));
        const data = { ...input.startup, industryIds: industryRows.map((r) => r.id).slice(0, 5) };
        if (existing?.isAdmin) await updateStartup(uid, existing.startup.id, data);
        else await createStartup(uid, data);
        break;
      }
      case "missing_skills": {
        if (!input.skillIds.length) break;
        const startup = await getPrimaryStartup(uid);
        await db.delete(needs).where(and(eq(needs.ownerId, uid), eq(needs.type, "cofounder"), eq(needs.title, "Cofounder with complementary skills")));
        await createNeed(uid, {
          startupId: startup?.isAdmin ? startup.startup.id : null,
          type: "cofounder",
          title: "Cofounder with complementary skills",
          description: "Added during onboarding.",
          skillIds: input.skillIds,
        });
        break;
      }
      case "help": {
        const startup = await getPrimaryStartup(uid);
        const existing = await db
          .select({ categoryId: needs.consultantCategoryId })
          .from(needs)
          .where(and(eq(needs.ownerId, uid), eq(needs.type, "consultant"), eq(needs.status, "open"), input.categoryIds.length ? inArray(needs.consultantCategoryId, input.categoryIds) : undefined));
        const have = new Set(existing.map((e) => e.categoryId));
        const { consultantCategories } = await import("@/server/db/schema");
        const cats = input.categoryIds.length
          ? await db.select().from(consultantCategories).where(inArray(consultantCategories.id, input.categoryIds))
          : [];
        for (const c of cats) {
          if (have.has(c.id)) continue;
          await createNeed(uid, {
            startupId: startup?.isAdmin ? startup.startup.id : null,
            type: "consultant",
            title: `${c.name} help`,
            consultantCategoryId: c.id,
          });
        }
        break;
      }
      case "progress":
        break;
    }
    await setOnboardingStep(uid, input.index + 1);
    track("onboarding_step_completed", uid, { step: input.step, index: input.index });
    return { ok: true };
  });
}

export async function finishOnboarding() {
  return runAction(async () => {
    const viewer = await requireViewer();
    await completeOnboarding(viewer.userId);
    return { ok: true };
  });
}
