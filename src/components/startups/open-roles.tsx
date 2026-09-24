"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { createOpenRoleAction, deleteOpenRoleAction, setOpenRoleOpenAction } from "@/app/(app)/startups/actions";
import { COMMITMENT_LABELS, type Commitment } from "@/lib/domain";

type Role = {
  id: string;
  title: string;
  type: string;
  description: string | null;
  commitment: Commitment | null;
  location: string | null;
  compensation: string | null;
  equity: string | null;
  isOpen: boolean;
};

const TYPE_LABEL: Record<string, string> = { cofounder: "Cofounder", employee: "Early employee", contractor: "Contractor", advisor: "Advisor" };

export function OpenRolesManager({
  roles,
  canManage,
  startupId,
  slug,
  founderHandle,
}: {
  roles: Role[];
  canManage: boolean;
  startupId: string;
  slug: string;
  founderHandle: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ title: "", type: "employee", description: "", location: "", compensation: "", equity: "" });
  const [busy, setBusy] = React.useState(false);

  async function create() {
    setBusy(true);
    const res = await createOpenRoleAction(startupId, { ...form, type: form.type as "employee" }, slug);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setOpen(false);
    setForm({ title: "", type: "employee", description: "", location: "", compensation: "", equity: "" });
    router.refresh();
  }

  return (
    <div>
      {roles.length === 0 ? (
        <p className="text-sm text-muted">{canManage ? "Post roles for early employees, contractors or advisors." : "No open roles right now."}</p>
      ) : (
        <ul className="divide-y divide-border">
          {roles.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{r.title}</p>
                  <Badge>{TYPE_LABEL[r.type] ?? r.type}</Badge>
                  {!r.isOpen && <Badge variant="neutral">Closed</Badge>}
                </div>
                {r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
                <p className="mt-1 text-xs text-subtle">
                  {[r.commitment && COMMITMENT_LABELS[r.commitment], r.location, r.compensation, r.equity && `Equity: ${r.equity}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              {canManage ? (
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const res = await setOpenRoleOpenAction(r.id, !r.isOpen, slug);
                      if (!res.ok) toast.error(res.error);
                      router.refresh();
                    }}
                  >
                    {r.isOpen ? "Close" : "Reopen"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const res = await deleteOpenRoleAction(r.id, slug);
                      if (!res.ok) toast.error(res.error);
                      router.refresh();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ) : (
                founderHandle && (
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/people/${founderHandle}`}>Contact founder</Link>
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <Button variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
          <Plus /> Post a role
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Post an open role">
          <div className="space-y-4">
            <Field label="Title" htmlFor="role-title">
              <Input id="role-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Founding engineer" maxLength={100} />
            </Field>
            <Field label="Type" htmlFor="role-type">
              <NativeSelect id="role-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Description" htmlFor="role-desc" optional>
              <Textarea id="role-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1500} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Location" htmlFor="role-loc" optional>
                <Input id="role-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Field>
              <Field label="Compensation" htmlFor="role-comp" optional>
                <Input id="role-comp" value={form.compensation} onChange={(e) => setForm({ ...form, compensation: e.target.value })} />
              </Field>
              <Field label="Equity" htmlFor="role-eq" optional>
                <Input id="role-eq" value={form.equity} onChange={(e) => setForm({ ...form, equity: e.target.value })} />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={create} loading={busy} disabled={form.title.trim().length < 2}>
                Post role
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
