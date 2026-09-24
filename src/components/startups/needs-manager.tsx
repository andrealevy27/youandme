"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, MoreHorizontal, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Chip } from "@/components/ui/chip";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { createNeedAction, deleteNeedAction, setNeedStatusAction } from "@/app/(app)/startups/actions";
import { NEED_TYPES, NEED_TYPE_LABELS, type NeedType } from "@/lib/domain";

export type NeedView = {
  id: string;
  type: NeedType;
  title: string;
  description: string | null;
  status: "open" | "paused" | "fulfilled" | "closed";
  skills: { id: string; name: string }[];
  category: { id: string; name: string; slug: string } | null;
};

function findHref(n: NeedView) {
  if (n.type === "consultant" || n.type === "freelancer") return n.category ? `/consultants?category=${n.category.slug}` : `/consultants?q=${encodeURIComponent(n.title)}`;
  if (n.type === "cofounder") return "/matches";
  return `/ai?q=${encodeURIComponent(`Find me ${n.title.toLowerCase()}`)}`;
}

export function NeedsManager({
  needs,
  canManage,
  startupId,
  slug,
  categories,
  skills,
}: {
  needs: NeedView[];
  canManage: boolean;
  startupId?: string | null;
  slug?: string;
  categories: { id: string; name: string }[];
  skills: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<NeedType>("consultant");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [skillIds, setSkillIds] = React.useState<string[]>([]);
  const [skillQuery, setSkillQuery] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function add() {
    setBusy(true);
    const res = await createNeedAction(
      { startupId: startupId ?? null, type, title, description, consultantCategoryId: type === "consultant" && categoryId ? categoryId : null, skillIds },
      slug,
    );
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setOpen(false);
    setTitle("");
    setDescription("");
    setSkillIds([]);
    router.refresh();
  }

  async function status(id: string, s: NeedView["status"]) {
    const res = await setNeedStatusAction(id, s, slug);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deleteNeedAction(id, slug);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }

  const visible = needs.filter((n) => canManage || n.status === "open");
  const filteredSkills = skills.filter((s) => s.name.toLowerCase().includes(skillQuery.toLowerCase())).slice(0, 24);

  return (
    <div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted">{canManage ? "Tell us what you need — a cofounder, a consultant, an advisor — and we'll surface the right people." : "Nothing listed right now."}</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((n) => (
            <li key={n.id} className="flex items-start gap-3 rounded-[12px] border border-border p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="brand">{NEED_TYPE_LABELS[n.type]}</Badge>
                  {n.status !== "open" && <Badge variant={n.status === "fulfilled" ? "success" : "neutral"}>{n.status}</Badge>}
                </div>
                <p className="mt-2 text-sm font-medium">{n.title}</p>
                {n.description && <p className="mt-1 text-sm text-muted">{n.description}</p>}
                {(n.skills.length > 0 || n.category) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {n.category && <Badge>{n.category.name}</Badge>}
                    {n.skills.map((s) => (
                      <Badge key={s.id}>{s.name}</Badge>
                    ))}
                  </div>
                )}
              </div>
              {canManage && n.status === "open" && (
                <Button size="sm" variant="soft" asChild>
                  <Link href={findHref(n)}>
                    <Search /> Find
                  </Link>
                </Button>
              )}
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label={`Manage ${n.title}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {n.status !== "fulfilled" && (
                      <DropdownMenuItem onSelect={() => status(n.id, "fulfilled")}>
                        <Check /> Mark as found
                      </DropdownMenuItem>
                    )}
                    {n.status === "open" ? (
                      <DropdownMenuItem onSelect={() => status(n.id, "paused")}>Pause</DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={() => status(n.id, "open")}>Reopen</DropdownMenuItem>
                    )}
                    <DropdownMenuItem destructive onSelect={() => remove(n.id)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <Button variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
          <Plus /> Add a need
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="What do you need?" description="Needs drive your recommendations across people, consultants and You&Me AI.">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {NEED_TYPES.map((t) => (
                <Chip key={t} size="sm" selected={type === t} onToggle={() => setType(t)}>
                  {NEED_TYPE_LABELS[t]}
                </Chip>
              ))}
            </div>
            <Field label="In a few words" htmlFor="need-title">
              <Input id="need-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Growth consultant for our TikTok launch" maxLength={120} />
            </Field>
            <Field label="Details" htmlFor="need-desc" optional>
              <Textarea id="need-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
            </Field>
            {type === "consultant" && (
              <Field label="Area of expertise" htmlFor="need-cat" optional>
                <NativeSelect id="need-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Any</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {type !== "consultant" && (
              <div>
                <p className="mb-2 text-[13px] font-medium">Skills needed</p>
                <Input value={skillQuery} onChange={(e) => setSkillQuery(e.target.value)} placeholder="Search skills" aria-label="Search skills" className="mb-3 h-9" />
                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {filteredSkills.map((s) => (
                    <Chip key={s.id} size="sm" selected={skillIds.includes(s.id)} onToggle={() => setSkillIds((ids) => (ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id].slice(0, 10)))}>
                      {s.name}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={add} loading={busy} disabled={title.trim().length < 2}>
                Add need
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
