import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { requireViewerPage } from "@/server/auth/session";
import { getPrimaryStartup, listNeedsForUser } from "@/server/startups";
import { db } from "@/server/db";
import { consultantCategories, skills } from "@/server/db/schema";
import { NeedsManager } from "@/components/startups/needs-manager";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "What you need" };

export default async function NeedsPage() {
  const viewer = await requireViewerPage();
  const [needs, startup, categories, skillRows] = await Promise.all([
    listNeedsForUser(viewer.userId),
    getPrimaryStartup(viewer.userId),
    db.select({ id: consultantCategories.id, name: consultantCategories.name }).from(consultantCategories).where(eq(consultantCategories.active, true)).orderBy(asc(consultantCategories.sortOrder)),
    db.select({ id: skills.id, name: skills.name }).from(skills).orderBy(asc(skills.name)),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Needs"
        title="What does your startup need?"
        description="Every need you add shapes your recommendations — people, consultants and You&Me AI answers."
      />
      <Card>
        <CardContent>
          <NeedsManager
            needs={needs.map((n) => ({ ...n, category: n.category ? { id: n.category.id, name: n.category.name, slug: n.category.slug } : null }))}
            canManage
            startupId={startup && (startup.isAdmin || startup.role === "cofounder" || startup.role === "founder") ? startup.startup.id : null}
            categories={categories}
            skills={skillRows}
          />
        </CardContent>
      </Card>
    </div>
  );
}
