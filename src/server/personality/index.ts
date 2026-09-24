import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { personalityAnswers, personalityProfiles, personalityQuestions } from "../db/schema";
import { AppError } from "../errors";
import { track } from "../analytics";
import { QUIZ_VERSION, scoreQuiz, type DimensionKey } from "@/lib/personality";

export async function getQuizQuestions() {
  return db
    .select({ id: personalityQuestions.id, key: personalityQuestions.key, prompt: personalityQuestions.prompt, topic: personalityQuestions.topic })
    .from(personalityQuestions)
    .where(eq(personalityQuestions.active, true))
    .orderBy(asc(personalityQuestions.order));
}

export async function getMyAnswers(userId: string) {
  const rows = await db.select().from(personalityAnswers).where(eq(personalityAnswers.userId, userId));
  return Object.fromEntries(rows.map((r) => [r.questionId, r.value]));
}

export const quizAnswersSchema = z.record(z.string().uuid(), z.number().int().min(1).max(5));

/** Stores answers and (re)computes the working-style profile. Requires every active question answered. */
export async function submitQuiz(userId: string, raw: Record<string, number>) {
  const answers = quizAnswersSchema.parse(raw);
  const questions = await db.select().from(personalityQuestions).where(eq(personalityQuestions.active, true));
  const missing = questions.filter((q) => answers[q.id] === undefined);
  if (missing.length) throw new AppError("VALIDATION", `Answer all ${questions.length} statements to see your profile.`);
  const byKey = Object.fromEntries(questions.map((q) => [q.key, answers[q.id]!]));
  const scores = scoreQuiz(
    byKey,
    questions.map((q) => ({ key: q.key, dimension: q.dimension as DimensionKey, polarity: q.polarity === 1 ? 1 : -1 })),
  );
  await db.transaction(async (tx) => {
    for (const q of questions) {
      await tx
        .insert(personalityAnswers)
        .values({ userId, questionId: q.id, value: answers[q.id]! })
        .onConflictDoUpdate({ target: [personalityAnswers.userId, personalityAnswers.questionId], set: { value: answers[q.id]!, answeredAt: new Date() } });
    }
    await tx
      .insert(personalityProfiles)
      .values({ userId, scores, version: QUIZ_VERSION })
      .onConflictDoUpdate({ target: personalityProfiles.userId, set: { scores, version: QUIZ_VERSION, completedAt: new Date() } });
  });
  track("quiz_completed", userId);
  return scores;
}

export async function getWorkingStyle(userId: string) {
  const [row] = await db.select().from(personalityProfiles).where(and(eq(personalityProfiles.userId, userId))).limit(1);
  return row ?? null;
}
