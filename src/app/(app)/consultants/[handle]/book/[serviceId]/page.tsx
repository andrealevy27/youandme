import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CreditCard } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { getAvailableSlots, getConsultantProfileByHandle } from "@/server/consultants";
import { getBookingStartupOptions } from "@/server/bookings";
import { computePlatformFee } from "@/server/payments/fees";
import { getSetting } from "@/server/settings";
import { track } from "@/server/analytics";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingStepper } from "@/components/bookings/booking-stepper";
import { bookAndPayAction, getSlotsAction } from "./actions";
import { messageConsultantAction } from "../../actions";
import { MessageConsultantButton } from "@/components/consultants/message-button";

export const metadata: Metadata = { title: "Book a session" };

export default async function BookPage({ params }: { params: Promise<{ handle: string; serviceId: string }> }) {
  const viewer = await requireViewerPage();
  const { handle, serviceId } = await params;
  const view = await getConsultantProfileByHandle(viewer.userId, decodeURIComponent(handle));
  if (!view) notFound();
  const { card: c, services, payment } = view;
  if (view.isOwn) redirect(`/consultants/${c.handle}`);
  const selected = services.find((s) => s.id === serviceId);
  if (!selected) {
    if (services[0]) redirect(`/consultants/${c.handle}/book/${services[0].id}`);
    notFound();
  }

  const back = (
    <Link href={`/consultants/${c.handle}`} className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-foreground">
      <ArrowLeft className="size-3.5" aria-hidden /> {c.name}
    </Link>
  );

  if (!c.acceptingClients || !payment.payable) {
    return (
      <div className="animate-fade-up">
        {back}
        <EmptyState
          icon={<CreditCard />}
          title={!c.acceptingClients ? "Not taking new clients" : "Booking isn't available here yet"}
          description={!c.acceptingClients || payment.payable ? `${c.name.split(" ")[0]} isn't taking new bookings right now.` : payment.reason}
          action={<MessageConsultantButton consultantId={c.userId} action={messageConsultantAction} label={`Message ${c.name.split(" ")[0]}`} />}
        />
      </div>
    );
  }

  const [slots, startups, feeBps] = await Promise.all([
    getAvailableSlots(c.userId, selected.id, new Date(), 21),
    getBookingStartupOptions(viewer.userId),
    getSetting("platform_fee_bps"),
  ]);
  track("service_selected", viewer.userId, { consultantId: c.userId, serviceId: selected.id, pricingType: selected.pricingType });

  return (
    <div className="animate-fade-up">
      {back}
      <h1 className="mb-6 text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">Book {c.name.split(" ")[0]}</h1>
      <BookingStepper
        consultant={{ id: c.userId, name: c.name, handle: c.handle, avatarUrl: c.avatarUrl }}
        services={services.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          pricingType: s.pricingType,
          priceCents: s.priceCents,
          currency: s.currency,
          billingInterval: s.billingInterval,
          durationMinutes: s.durationMinutes,
          feeCents: computePlatformFee(s.priceCents, feeBps),
        }))}
        initialServiceId={selected.id}
        initialSlots={{ hasRules: slots.hasRules, slots: slots.slots.map((s) => s.startsAt.toISOString()) }}
        viewerTimezone={viewer.timezone}
        startups={startups}
        testMode={payment.payable && payment.testMode}
        feePercentLabel={`${(feeBps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`}
        actions={{ getSlots: getSlotsAction, book: bookAndPayAction }}
      />
      <p className="mt-8 text-center text-xs text-subtle">
        Questions first?{" "}
        <Button asChild variant="link" size="sm" className="text-xs">
          <Link href={`/consultants/${c.handle}`}>Message {c.name.split(" ")[0]} from their profile</Link>
        </Button>
      </p>
    </div>
  );
}
