import { Badge } from "@/components/ui/badge";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "outline";

const TONES: Record<string, Tone> = {
  // accounts
  active: "success",
  suspended: "warning",
  banned: "danger",
  deleted: "neutral",
  // consultants
  draft: "neutral",
  pending_review: "warning",
  approved: "success",
  rejected: "danger",
  // reports
  open: "warning",
  reviewing: "brand",
  actioned: "success",
  dismissed: "neutral",
  // bookings / payments
  pending_payment: "warning",
  pending: "warning",
  confirmed: "brand",
  completed: "success",
  cancelled: "neutral",
  refunded: "neutral",
  disputed: "danger",
  // reviews / visibility
  published: "success",
  hidden: "danger",
  public: "success",
  members: "brand",
  // verification / waitlist / invites
  verified: "success",
  expired: "neutral",
  waiting: "warning",
  invited: "brand",
  joined: "success",
  used: "neutral",
  live: "success",
};

export function statusLabel(status: string) {
  const s = status.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge variant={TONES[status] ?? "outline"}>{label ?? statusLabel(status)}</Badge>;
}
