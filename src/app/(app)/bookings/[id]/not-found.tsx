import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function BookingNotFound() {
  return (
    <EmptyState
      icon={<CalendarX2 />}
      title="Booking not found"
      description="It may not exist, or you're not part of it."
      action={
        <Button asChild>
          <Link href="/bookings">Your bookings</Link>
        </Button>
      }
    />
  );
}
