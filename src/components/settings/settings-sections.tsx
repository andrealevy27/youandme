"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { OptionCard } from "@/components/ui/chip";
import { authClient } from "@/lib/auth-client";
import { VISIBILITY, VISIBILITY_LABELS, type Visibility } from "@/lib/domain";
import { deleteAccountAction, requestUniversityVerificationAction, setVisibilityAction, unblockAction } from "@/app/(app)/settings/actions";

export function ChangePasswordForm() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (next.length < 10) return toast.error("Use at least 10 characters.");
        setBusy(true);
        const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
        setBusy(false);
        if (error) return toast.error(error.message ?? "Couldn't change your password.");
        setCurrent("");
        setNext("");
        toast.success("Password changed. Other devices were signed out.");
      }}
    >
      <Field label="Current password" htmlFor="pw-current">
        <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="New password" htmlFor="pw-new" hint="At least 10 characters.">
        <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" variant="secondary" loading={busy} disabled={!current || !next}>
          Change password
        </Button>
      </div>
    </form>
  );
}

export function VisibilityForm({ initial }: { initial: Visibility }) {
  const [value, setValue] = React.useState(initial);
  return (
    <div className="grid gap-2.5" role="radiogroup" aria-label="Profile visibility">
      {VISIBILITY.map((v) => (
        <OptionCard
          key={v}
          selected={value === v}
          title={v === "public" ? "Public" : v === "members" ? "Connections only" : "Hidden"}
          description={VISIBILITY_LABELS[v]}
          onSelect={async () => {
            const prev = value;
            setValue(v);
            const res = await setVisibilityAction(v);
            if (!res.ok) {
              setValue(prev);
              toast.error(res.error);
            } else toast.success("Visibility updated.");
          }}
        />
      ))}
    </div>
  );
}

export function UniversityVerification() {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  if (sentTo) return <p className="text-sm text-muted">Check {sentTo} for a confirmation link. It expires in 24 hours.</p>;
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await requestUniversityVerificationAction(email);
        setBusy(false);
        if (!res.ok) return toast.error(res.error);
        setSentTo(email);
      }}
    >
      <Field label="University email" htmlFor="univ-email" className="flex-1" hint="We only confirm you can receive email at an academic domain.">
        <Input id="univ-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" />
      </Field>
      <Button type="submit" variant="secondary" loading={busy} disabled={!email.includes("@")} className="sm:mb-6">
        Send link
      </Button>
    </form>
  );
}

export function BlockedList({ people }: { people: { userId: string; name: string; handle: string; avatarUrl: string | null }[] }) {
  const router = useRouter();
  if (!people.length) return <p className="text-sm text-muted">You haven&apos;t blocked anyone.</p>;
  return (
    <ul className="divide-y divide-border">
      {people.map((p) => (
        <li key={p.userId} className="flex items-center gap-3 py-3 first:pt-0">
          <Avatar name={p.name} src={p.avatarUrl} size="sm" />
          <span className="flex-1 text-sm font-medium">{p.name}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const res = await unblockAction(p.userId);
              if (!res.ok) return toast.error(res.error);
              router.refresh();
            }}
          >
            Unblock
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function DangerZone() {
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="mt-8 rounded-[14px] border border-danger/30 p-4">
      <p className="text-sm font-semibold text-danger">Delete account</p>
      <p className="mt-1 text-sm text-muted">
        We erase your profile, skills, quiz answers, matches, saved items and sign-in methods. Messages you sent stay visible to the people you sent them to as
        “Deleted member”, and booking and payment records are kept (anonymised) for legal and financial reasons.
      </p>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="danger" size="sm" className="mt-4">
            Delete my account
          </Button>
        </DialogTrigger>
        <DialogContent title="Delete your account?" description="This can't be undone. Type DELETE to confirm.">
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type DELETE to confirm" autoComplete="off" />
          <div className="mt-4 flex justify-end">
            <Button
              variant="danger"
              disabled={confirm !== "DELETE"}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const res = await deleteAccountAction(confirm);
                if (!res.ok) {
                  setBusy(false);
                  return toast.error(res.error);
                }
                await authClient.signOut().catch(() => undefined);
                window.location.href = "/";
              }}
            >
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
