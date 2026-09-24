"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { submitQuiz } from "@/server/personality";

export async function submitQuizAction(answers: Record<string, number>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    await submitQuiz(viewer.userId, answers);
    revalidatePath("/working-style");
    revalidatePath("/home");
    return { ok: true };
  });
}
