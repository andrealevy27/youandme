"use client";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { NOTIFICATION_TYPE_LABELS, type NotificationType } from "@/lib/domain";
import { updateNotificationPreferenceAction } from "./actions";

export type PreferenceRowProps = { type: NotificationType; inApp: boolean; email: boolean; push: boolean; mandatory: boolean };

export function NotificationPreferencesForm({ initial }: { initial: PreferenceRowProps[] }) {
  const [rows, setRows] = React.useState(initial);

  async function toggle(type: NotificationType, channel: "inApp" | "email", enabled: boolean) {
    const before = rows;
    setRows((cur) => cur.map((r) => (r.type === type ? { ...r, [channel]: enabled } : r)));
    const res = await updateNotificationPreferenceAction({ type, channel, enabled });
    if (!res.ok) {
      setRows(before);
      toast.error(res.error);
    }
  }

  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-card">
      <div className="hidden grid-cols-[1fr_72px_72px_96px] items-center gap-2 border-b border-border px-5 py-3 text-xs font-medium text-subtle sm:grid">
        <span>Notify me about</span>
        <span className="text-center">In-app</span>
        <span className="text-center">Email</span>
        <span className="text-center">Push</span>
      </div>
      <ul>
        {rows.map((r) => {
          const label = NOTIFICATION_TYPE_LABELS[r.type];
          return (
            <li key={r.type} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3 border-b border-border px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_72px_72px_96px] sm:gap-2">
              <span className="col-span-2 text-sm font-medium sm:col-span-1">
                {label}
                {r.mandatory && <span className="mt-0.5 block text-xs font-normal text-muted">Security notices are always delivered.</span>}
              </span>
              <ChannelSwitch label="In-app" aria={`${label}: in-app`} checked={r.inApp || r.mandatory} disabled={r.mandatory} onChange={(v) => toggle(r.type, "inApp", v)} />
              <ChannelSwitch label="Email" aria={`${label}: email`} checked={r.email || r.mandatory} disabled={r.mandatory} onChange={(v) => toggle(r.type, "email", v)} />
              <span className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:justify-center">
                <span className="text-[13px] text-muted sm:hidden">Push</span>
                <Badge title="Push notifications are coming soon">Coming soon</Badge>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ChannelSwitch({ label, aria, checked, disabled, onChange }: { label: string; aria: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:justify-center">
      <span className="text-[13px] text-muted sm:hidden">{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={aria} />
    </span>
  );
}
