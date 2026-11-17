import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { personalityAnswers, personalityProfiles, personalityQuestions, profiles } from "../db/schema";
import { AppError } from "../errors";
import { track } from "../analytics";
import { completeOnboarding, setOnboardingStep, setUserIndustries, setUserSkills } from "../people/profile";
import { updateStudentPrefs, CAMPUS_SCOPES } from ".";
import { COFOUNDER_TYPES, type Availability, type Commitment } from "@/lib/domain";
import { QUIZ_VERSION, scoreQuiz, type DimensionKey } from "@/lib/personality";
import { CLASS_YEARS, IDEA_STATUSES, SHORT_QUIZ_KEYS, SUMMER_PLANS } from "@/lib/student";

const keys = <T extends readonly { key: string }[]>(opts: T) => opts.map((o) => o.key) as [T[number]["key"], ...T[number]["key"][]];

const about = z.object({
  displayName: z.string().trim().min(1, "Add your name.").max(80),
  classYear: z.enum(keys(CLASS_YEARS)),
  major: z.string().trim().min(1, "Add your major (or 'Undeclared').").max(80),
});
const idea = z.object({
  ideaStatus: z.enum(keys(IDEA_STATUSES)),
  ideaSummary: z.string().trim().max(200).optional().default(""),
});
const lookingFor = z.object({
  cofounderTypes: z.array(z.enum(COFOUNDER_TYPES)).min(1, "Pick at least one.").max(3),
  lookingFor: z.string().trim().max(280).optional().default(""),
});
const time = z.object({
  weeklyHours: z.number().int().min(1).max(60),
  summerPlans: z.enum(keys(SUMMER_PLANS)),
});

export const studentStepSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("about"), index: z.number().int(), data: about }),
  z.object({ step: z.literal("skills"), index: z.number().int(), skillIds: z.array(z.string().uuid()).min(1, "Pick at least one skill.").max(6) }),
  z.object({ step: z.literal("idea"), index: z.number().int(), data: idea }),
  z.object({ step: z.literal("looking_for"), index: z.number().int(), data: lookingFor, industryIds: z.array(z.string().uuid()).max(3) }),
  z.object({ step: z.literal("time"), index: z.number().int(), data: time }),
  z.object({ step: z.literal("quiz"), index: z.number().int(), answers: z.record(z.string(), z.number().int().min(1).max(5)) }),
]);
export type StudentStepInput = z.input<typeof studentStepSchema>;

/** Hours and summer plans → the existing matching fields, so the matching engine works unchanged. */
export function toMatchingFields(weeklyHours: number, summerPlans: string): { availability: Availability; commitment: Commitment } {
  const availability: Availability = weeklyHours >= 20 ? "part_time" : weeklyHours >= 10 ? "part_time" : weeklyHours >= 5 ? "nights_weekends" : "limited";
  const commitment: Commitment =
    summerPlans === "build" || summerPlans === "graduating" ? "full_time_soon" : weeklyHours < 5 ? "exploring" : "part_time";
  return { availability, commitment };
}

export async function saveStudentStep(userId: string, raw: StudentStepInput) {
  const input = studentStepSchema.parse(raw);
  switch (input.step) {
    case "about": {
      // A readable headline for cards ("Computer Science · Junior"); editable later from the profile.
      const year = CLASS_YEARS.find((y) => y.key === input.data.classYear)!.label;
      const headline = input.data.major.toLowerCase() === year.toLowerCase() ? year : `${input.data.major} · ${year}`;
      await db.update(profiles).set({ ...input.data, headline }).where(eq(profiles.userId, userId));
      break;
    }
    case "skills":
      await setUserSkills(userId, input.skillIds, input.skillIds.slice(0, 2));
      break;
    case "idea": {
      const intents = input.data.ideaStatus === "have_idea" ? ["building", "cofounder"] : input.data.ideaStatus === "join_one" ? ["join", "cofounder"] : ["building", "join", "cofounder"];
      await db
        .update(profiles)
        .set({ ideaStatus: input.data.ideaStatus, ideaSummary: input.data.ideaSummary || null, intents, lookingForCofounder: true })
        .where(eq(profiles.userId, userId));
      break;
    }
    case "looking_for":
      await db
        .update(profiles)
        .set({ cofounderTypes: input.data.cofounderTypes, lookingFor: input.data.lookingFor || null })
        .where(eq(profiles.userId, userId));
      await setUserIndustries(userId, input.industryIds);
      break;
    case "time":
      await db
        .update(profiles)
        .set({ ...input.data, ...toMatchingFields(input.data.weeklyHours, input.data.summerPlans) })
        .where(eq(profiles.userId, userId));
      break;
    case "quiz":
      await submitShortQuiz(userId, input.answers);
      break;
  }
  await setOnboardingStep(userId, input.index + 1);
  track("onboarding_step_completed", userId, { step: `student_${input.step}`, index: input.index });
}

/**
 * Seven statements, one per working-style dimension. Answers are stored like full-quiz answers,
 * so taking the full 21-question quiz later simply refines the same profile.
 */
export async function submitShortQuiz(userId: string, answersByKey: Record<string, number>) {
  const questions = await db.select().from(personalityQuestions).where(inArray(personalityQuestions.key, [...SHORT_QUIZ_KEYS]));
  const missing = questions.filter((q) => answersByKey[q.key] === undefined);
  if (missing.length) throw new AppError("VALIDATION", "Answer all seven statements — there are no wrong answers.");
  const scores = scoreQuiz(
    answersByKey,
    questions.map((q) => ({ key: q.key, dimension: q.dimension as DimensionKey, polarity: q.polarity === 1 ? 1 : -1 })),
  );
  await db.transaction(async (tx) => {
    for (const q of questions) {
      const value = answersByKey[q.key]!;
      await tx
        .insert(personalityAnswers)
        .values({ userId, questionId: q.id, value })
        .onConflictDoUpdate({ target: [personalityAnswers.userId, personalityAnswers.questionId], set: { value, answeredAt: new Date() } });
    }
    await tx
      .insert(personalityProfiles)
      .values({ userId, scores, version: QUIZ_VERSION })
      .onConflictDoUpdate({ target: personalityProfiles.userId, set: { scores, version: QUIZ_VERSION, completedAt: new Date() } });
  });
  track("quiz_completed", userId, { short: true });
}

const finishSchema = z.object({ visible: z.boolean(), campusScope: z.enum(CAMPUS_SCOPES) });

export async function finishStudentOnboarding(userId: string, raw: z.input<typeof finishSchema>) {
  const input = finishSchema.parse(raw);
  await updateStudentPrefs(userId, input);
  await completeOnboarding(userId);
}
