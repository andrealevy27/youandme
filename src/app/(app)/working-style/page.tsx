import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Sparkles } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { getWorkingStyle } from "@/server/personality";
import { WorkingStyleBars } from "@/components/people/working-style";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DIMENSIONS, DIMENSION_KEYS, describeDimension, type DimensionKey } from "@/lib/personality";

export const metadata: Metadata = { title: "Your working style" };

const PAIRING_COPY: Record<DimensionKey, string> = {
  vision_operator: "Teams do best with both. We look for someone who balances you here.",
  pace: "Big pace gaps create friction. We favour people who move at a similar speed.",
  structure: "Similar preferences make day-to-day work smoother.",
  autonomy: "Matching how much you like to work together avoids resentment later.",
  risk: "Aligned risk appetite matters for big calls like quitting jobs and raising money.",
  communication: "Similar styles mean fewer misunderstandings in hard conversations.",
  focus: "Complementary — someone who covers the other end helps a lot.",
};

export default async function WorkingStylePage({ searchParams }: { searchParams: Promise<{ completed?: string }> }) {
  const viewer = await requireViewerPage();
  const [style, sp] = await Promise.all([getWorkingStyle(viewer.userId), searchParams]);
  if (!style) {
    return (
      <>
        <PageHeader title="Your working style" />
        <EmptyState
          icon={<ClipboardList />}
          title="You haven't taken the quiz yet"
          description="21 quick statements about decisions, conflict, risk and pace. It sharpens every cofounder recommendation."
          action={
            <Button asChild>
              <Link href="/quiz">Take the quiz</Link>
            </Button>
          }
        />
      </>
    );
  }
  const scores = style.scores as Partial<Record<DimensionKey, number>>;
  const strongest = DIMENSION_KEYS.filter((k) => scores[k] !== undefined)
    .sort((a, b) => Math.abs(scores[b]!) - Math.abs(scores[a]!))
    .slice(0, 3);
  return (
    <>
      <PageHeader
        eyebrow={sp.completed ? "Quiz complete" : undefined}
        title="Your working style"
        description="How you like to build — used to explain who you'll work well with and where you might clash."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/quiz">Retake quiz</Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent>
            <WorkingStyleBars scores={scores} />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardContent>
              <h2 className="mb-3 text-[15px] font-semibold">What stands out</h2>
              <ul className="space-y-3">
                {strongest.map((k) => (
                  <li key={k} className="text-sm">
                    <span className="font-medium">{describeDimension(k, scores[k]!)}.</span>{" "}
                    <span className="text-muted">{PAIRING_COPY[k]}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="bg-brand-soft/60">
            <CardContent className="flex gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden />
              <div>
                <p className="text-sm font-medium">This now shapes your matches</p>
                <p className="mt-1 text-sm text-muted">
                  Each recommendation explains where you&apos;re aligned — and flags friction, like different {DIMENSIONS.pace.left.toLowerCase()} vs{" "}
                  {DIMENSIONS.pace.right.toLowerCase()} styles.
                </p>
                <Button size="sm" className="mt-4" asChild>
                  <Link href="/matches">See today&apos;s matches</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-subtle">A self-described working-style profile, not a clinical or psychological assessment.</p>
        </div>
      </div>
    </>
  );
}
