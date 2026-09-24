"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Briefcase, FolderInput, MoreHorizontal, Pencil, Plus, Rocket, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/input";
import type { SaveTarget } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { createCollectionAction, deleteCollectionAction, moveSavedItemAction, removeSavedItemAction, renameCollectionAction } from "./actions";

type Collection = { id: string; name: string; isDefault: boolean; count: number };
type TypeFilter = "all" | "people" | "consultants" | "startups";
export type SavedCardItem = {
  itemId: string;
  collectionId: string;
  targetType: SaveTarget;
  targetId: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  href: string;
  isDemo: boolean;
};

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "people", label: "People" },
  { key: "consultants", label: "Consultants" },
  { key: "startups", label: "Startups" },
];

const TYPE_META: Record<SaveTarget, { label: string; icon: typeof User }> = {
  user: { label: "Person", icon: User },
  consultant: { label: "Consultant", icon: Briefcase },
  startup: { label: "Startup", icon: Rocket },
};

function href(collectionId: string, type: TypeFilter, defaultId: string) {
  const p = new URLSearchParams();
  if (collectionId !== defaultId) p.set("c", collectionId);
  if (type !== "all") p.set("type", type);
  const q = p.toString();
  return q ? `/saved?${q}` : "/saved";
}

export function SavedBoard({
  collections,
  activeCollectionId,
  typeFilter,
  items: initialItems,
}: {
  collections: Collection[];
  activeCollectionId: string;
  typeFilter: TypeFilter;
  items: SavedCardItem[];
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(initialItems);
  const [prevInitial, setPrevInitial] = React.useState(initialItems);
  if (prevInitial !== initialItems) {
    // Server re-render (filter change / revalidation) — adopt the fresh list.
    setPrevInitial(initialItems);
    setItems(initialItems);
  }
  const [dialog, setDialog] = React.useState<null | { mode: "create" } | { mode: "rename"; collection: Collection } | { mode: "delete"; collection: Collection }>(null);
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const defaultId = collections.find((c) => c.isDefault)?.id ?? activeCollectionId;
  const active = collections.find((c) => c.id === activeCollectionId);

  function openDialog(d: NonNullable<typeof dialog>) {
    setName(d.mode === "rename" ? d.collection.name : "");
    setDialog(d);
  }

  function submitDialog() {
    if (!dialog) return;
    startTransition(async () => {
      if (dialog.mode === "create") {
        const res = await createCollectionAction(name);
        if (!res.ok) return void toast.error(res.error);
        setDialog(null);
        router.push(href(res.data.id, "all", defaultId));
      } else if (dialog.mode === "rename") {
        const res = await renameCollectionAction(dialog.collection.id, name);
        if (!res.ok) return void toast.error(res.error);
        setDialog(null);
        router.refresh();
      } else {
        const res = await deleteCollectionAction(dialog.collection.id);
        if (!res.ok) return void toast.error(res.error);
        setDialog(null);
        toast.success("Collection deleted. Its items moved to Saved.");
        router.push("/saved");
      }
    });
  }

  function remove(item: SavedCardItem) {
    const before = items;
    setItems((cur) => cur.filter((i) => i.itemId !== item.itemId));
    startTransition(async () => {
      const res = await removeSavedItemAction(item.itemId);
      if (!res.ok) {
        setItems(before);
        toast.error(res.error);
        return;
      }
      toast.success(`Removed ${item.title}`);
      router.refresh();
    });
  }

  function move(item: SavedCardItem, target: Collection) {
    const before = items;
    setItems((cur) => cur.filter((i) => i.itemId !== item.itemId));
    startTransition(async () => {
      const res = await moveSavedItemAction(item.itemId, target.id);
      if (!res.ok) {
        setItems(before);
        toast.error(res.error);
        return;
      }
      toast.success(`Moved to ${target.name}`);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      <nav aria-label="Collections" className="min-w-0">
        <div className="mb-2 hidden items-center justify-between px-1 lg:flex">
          <span className="text-xs font-medium tracking-wide text-subtle uppercase">Collections</span>
        </div>
        <ul className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
          {collections.map((c) => {
            const isActive = c.id === activeCollectionId;
            return (
              <li key={c.id} className="shrink-0">
                <Link
                  href={href(c.id, typeFilter, defaultId)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors lg:h-10 lg:rounded-[10px] lg:px-3",
                    isActive ? "bg-ink text-ink-foreground lg:bg-card lg:text-foreground lg:shadow-soft lg:ring-1 lg:ring-border" : "bg-surface text-muted hover:text-foreground lg:bg-transparent lg:hover:bg-surface",
                  )}
                >
                  {c.isDefault && <Bookmark className="size-4 shrink-0" aria-hidden />}
                  <span className="max-w-40 truncate lg:flex-1">{c.name}</span>
                  <span className={cn("text-xs tabular-nums", isActive ? "opacity-70" : "text-subtle")}>{c.count}</span>
                </Link>
              </li>
            );
          })}
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => openDialog({ mode: "create" })}
              className="flex h-9 items-center gap-2 rounded-full border border-dashed border-border-strong px-3.5 text-sm font-medium text-muted hover:text-foreground lg:mt-1 lg:h-10 lg:w-full lg:rounded-[10px] lg:px-3"
            >
              <Plus className="size-4" aria-hidden /> New collection
            </button>
          </li>
        </ul>
      </nav>

      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Filter by type" className="scrollbar-none flex gap-1 overflow-x-auto">
            {TYPE_FILTERS.map((f) => (
              <Link
                key={f.key}
                role="tab"
                aria-selected={typeFilter === f.key}
                href={href(activeCollectionId, f.key, defaultId)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-medium transition-colors",
                  typeFilter === f.key ? "bg-surface text-foreground ring-1 ring-border-strong" : "text-muted hover:text-foreground",
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>
          {active && !active.isDefault && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label={`Options for ${active.name}`}>
                  <MoreHorizontal /> Collection
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => openDialog({ mode: "rename", collection: active })}>
                  <Pencil /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => openDialog({ mode: "delete", collection: active })}>
                  <Trash2 /> Delete collection
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={<Bookmark />}
            title={typeFilter === "all" ? "Nothing saved here yet" : `No saved ${typeFilter} here`}
            description="Tap Save on a profile, consultant or startup to keep it for later. Organise them into collections as your search takes shape."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild size="sm">
                  <Link href="/discover">Discover people</Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/consultants">Browse consultants</Link>
                </Button>
              </div>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const meta = TYPE_META[item.targetType];
              const others = collections.filter((c) => c.id !== item.collectionId);
              return (
                <li key={item.itemId} className="group relative">
                  <Link
                    href={item.href}
                    className="flex h-full items-center gap-3.5 rounded-[16px] border border-border bg-card p-4 pr-12 shadow-soft transition-shadow hover:shadow-float"
                  >
                    <Avatar name={item.title} src={item.imageUrl} size="lg" rounded={item.targetType === "startup" ? "xl" : "full"} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold">{item.title}</span>
                        {item.isDemo && <DemoBadge />}
                      </span>
                      {item.subtitle && <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">{item.subtitle}</span>}
                      <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-subtle">
                        <meta.icon className="size-3.5" aria-hidden /> {meta.label}
                      </span>
                    </span>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="absolute top-3 right-3 rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground"
                      aria-label={`Options for ${item.title}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {others.length > 0 && (
                        <>
                          <DropdownMenuLabel>Move to</DropdownMenuLabel>
                          {others.map((c) => (
                            <DropdownMenuItem key={c.id} onSelect={() => move(item, c)}>
                              <FolderInput /> {c.name}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem destructive onSelect={() => remove(item)}>
                        <Trash2 /> Remove from saved
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        {dialog && (
          <DialogContent
            title={dialog.mode === "create" ? "New collection" : dialog.mode === "rename" ? "Rename collection" : `Delete “${dialog.collection.name}”?`}
            description={dialog.mode === "delete" ? "Its items won't be lost — they'll move back to Saved." : undefined}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitDialog();
              }}
            >
              {dialog.mode !== "delete" && (
                <Field label="Name" htmlFor="collection-name">
                  <Input
                    id="collection-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                    placeholder="e.g. Technical cofounders"
                    autoFocus
                  />
                </Field>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={dialog.mode === "delete" ? "danger" : "primary"}
                  loading={pending}
                  disabled={dialog.mode !== "delete" && !name.trim()}
                >
                  {dialog.mode === "create" ? "Create" : dialog.mode === "rename" ? "Save" : "Delete"}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
