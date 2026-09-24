import type { Metadata } from "next";
import { requireViewerPage } from "@/server/auth/session";
import { getMyAnswers, getQuizQuestions } from "@/server/personality";
import { QuizRunner } from "@/components/quiz/quiz-runner";

export const metadata: Metadata = { title: "Working-style quiz" };

export default async function QuizPage() {
  const viewer = await requireViewerPage();
  const [questions, answers] = await Promise.all([getQuizQuestions(), getMyAnswers(viewer.userId)]);
  return <QuizRunner questions={questions} initialAnswers={answers} />;
}
