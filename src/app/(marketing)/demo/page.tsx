import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoExperience } from "@/components/student/demo-experience";
import { env } from "@/server/env";
import { buildDemo } from "@/server/student/demo";

export const metadata: Metadata = {
  title: "Demo",
  description: "See how FoundMate introduces student founders — with sample students, no sign-up.",
  robots: { index: false },
};

/** Guest preview with sample data: nothing is read from or written to the database. */
export default function DemoPage() {
  if (!env.STUDENT_MODE) notFound();
  return <DemoExperience personas={buildDemo()} />;
}
