import type { Metadata } from "next";
import { SavedBoard } from "@/components/saved/saved-board";
import { PageHeader } from "@/components/ui/page-header";
import { requireViewerPage } from "@/server/auth/session";
import { listCollections, listSaved } from "@/server/saved";
import type { SaveTarget } from "@/lib/domain";

export const metadata: Metadata = { title: "Saved" };

const TYPE_PARAM: Record<string, SaveTarget> = { people: "user", consultants: "consultant", startups: "startup" };

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ c?: string; type?: string }> }) {
  const viewer = await requireViewerPage();
  const sp = await searchParams;
  const collections = await listCollections(viewer.userId);
  const active = collections.find((c) => c.id === sp.c) ?? collections.find((c) => c.isDefault)!;
  const typeKey = sp.type && TYPE_PARAM[sp.type] ? sp.type : "all";
  const items = await listSaved(viewer.userId, { collectionId: active.id, targetType: TYPE_PARAM[typeKey] });

  return (
    <div>
      <PageHeader title="Saved" description="People, consultants and startups you want to come back to." />
      <SavedBoard
        collections={collections.map((c) => ({ id: c.id, name: c.name, isDefault: c.isDefault, count: c.count }))}
        activeCollectionId={active.id}
        typeFilter={typeKey as "all" | "people" | "consultants" | "startups"}
        items={items}
      />
    </div>
  );
}
