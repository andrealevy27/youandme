import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/domain";

const LABELS: Record<BookingStatus, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  disputed: "In dispute",
};

const VARIANTS: Record<BookingStatus, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  pending_payment: "warning",
  confirmed: "brand",
  completed: "success",
  cancelled: "neutral",
  refunded: "neutral",
  disputed: "danger",
};

export function BookingStatusBadge({ status, needsCompletion }: { status: BookingStatus; needsCompletion?: boolean }) {
  if (status === "confirmed" && needsCompletion) return <Badge variant="warning">Awaiting completion</Badge>;
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
