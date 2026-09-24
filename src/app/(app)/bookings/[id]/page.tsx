import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, CheckCircle2, Circle, FlaskConical, MessageCircle, XCircle } from "lucide-react";
import { requireViewerPage } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { getBookingForViewer } from "@/server/bookings";
import { Avatar } from "@/components/ui/avatar";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookingActions } from "@/components/bookings/booking-actions";
import { BookingStatusBadge } from "@/components/bookings/status-badge";
import { ReviewForm } from "@/components/bookings/review-form";
import { Stars } from "@/components/consultants/rating";
import { formatDateTimeRange, formatServicePrice } from "@/components/consultants/format";
import { cn, formatMoney } from "@/lib/utils";
import { cancelBookingAction, completeBookingAction, disputeBookingAction, payBookingAction, refundBookingAction, submitReviewAction } from "./actions";

export const metadata: Metadata = { title: "Booking" };

type Detail = Awaited<ReturnType<typeof getBookingForViewer>>;

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ checkout?: string }> }) {
  const viewer = await requireViewerPage();
  const { id } = await params;
  const { checkout } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let detail: Detail;
  try {
    detail = await getBookingForViewer(viewer.userId, id, { adminRole: viewer.adminRole });
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    throw err;
  }
  const { booking: b, participants, viewerRole, payment, review, can } = detail;
  const tz = viewer.timezone;
  const when = formatDateTimeRange(b.startsAt, b.endsAt, tz);
  const consultant = participants.find((p) => p.role === "consultant");
  const client = participants.find((p) => p.role === "client");
  const testMode = payment?.provider === "dev" || (detail.payable?.payable === true && detail.payable.testMode);
  const now = new Date();

  return (
    <div className="animate-fade-up">
      <Link href="/bookings" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden /> Bookings
      </Link>

      {checkout === "success" && b.status === "confirmed" && (
        <Banner tone="success" icon={<CheckCircle2 />}>
          <strong>You&apos;re booked.</strong> {consultant?.name ?? "Your consultant"} has been notified
          {b.conversationId ? " and a conversation is ready below." : "."}
        </Banner>
      )}
      {checkout === "success" && b.status === "pending_payment" && (
        <Banner tone="neutral" icon={<Circle />}>
          We&apos;re waiting for payment confirmation from Stripe. This usually takes a few seconds — refresh in a moment.
        </Banner>
      )}
      {checkout === "cancelled" && b.status === "pending_payment" && (
        <Banner tone="neutral" icon={<XCircle />}>
          Checkout was cancelled — you haven&apos;t been charged. Your time is held for a few more minutes.
        </Banner>
      )}
      {testMode && (
        <Banner tone="warning" icon={<FlaskConical />}>
          <strong>Test mode — no money moves.</strong> Payments on this environment are simulated.
        </Banner>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={b.status} needsCompletion={b.status === "confirmed" && b.endsAt < now} />
            {viewerRole && <Badge variant="outline">{viewerRole === "client" ? "You booked" : viewerRole === "consultant" ? "You're the consultant" : "You're invited"}</Badge>}
          </div>
          <h1 className="mt-3 text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">{b.serviceTitle}</h1>
          <p className="mt-1 text-[15px] text-muted">
            {when.day} · {when.time} {when.zone}
          </p>
        </div>
      </header>

      <div className="mt-6">
        <BookingActions
          bookingId={b.id}
          can={can}
          cancelBlockedReason={can.cancelBlockedReason}
          isPaid={b.status === "confirmed"}
          testMode={!!testMode}
          handlers={{ pay: payBookingAction, cancel: cancelBookingAction, complete: completeBookingAction, dispute: disputeBookingAction, refund: refundBookingAction }}
        />
        {detail.holdExpired && viewerRole === "client" && (
          <p className="mt-3 text-sm text-muted">
            This booking&apos;s time hold expired before payment.{" "}
            {consultant && (
              <Link href={`/consultants/${consultant.handle}`} className="text-brand-ink underline-offset-2 hover:underline">
                Pick a new time
              </Link>
            )}
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {can.review && consultant && (
            <Card id="review">
              <CardContent>
                <h2 className="text-[17px] font-semibold tracking-tight">How was your session with {consultant.name.split(" ")[0]}?</h2>
                <p className="mt-1 mb-5 text-sm text-muted">Reviews are only possible after a completed booking, so they&apos;re always from real clients.</p>
                <ReviewForm bookingId={b.id} consultantName={consultant.name} submit={submitReviewAction} />
              </CardContent>
            </Card>
          )}
          {review && (
            <Card id="review">
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[15px] font-semibold">{viewerRole === "client" ? "Your review" : "Client review"}</h2>
                  <Stars value={review.overall} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
                  {(["expertise", "communication", "value", "reliability"] as const).map((k) => (
                    <div key={k}>
                      <dt className="text-muted capitalize">{k}</dt>
                      <dd className="font-medium tabular-nums">{review[k]} / 5</dd>
                    </div>
                  ))}
                </dl>
                {review.body && <p className="mt-3 text-sm leading-relaxed">{review.body}</p>}
              </CardContent>
            </Card>
          )}

          {b.projectContext && (
            <Card>
              <CardContent>
                <h2 className="text-[15px] font-semibold">Project context</h2>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-foreground/90">{b.projectContext}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <h2 className="text-[15px] font-semibold">Timeline</h2>
              <Timeline detail={detail} tz={tz} />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <CalendarPlus className="size-4 text-muted" aria-hidden /> Calendar
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {can.downloadIcs ? (
                  <Button asChild variant="secondary" size="sm">
                    <a href={`/api/v1/bookings/${b.id}/ics`} download>
                      Add to calendar (.ics)
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted">A calendar file is available once the booking is confirmed.</p>
                )}
                <span className="inline-flex items-center gap-2 text-[13px] text-muted">
                  Google Calendar sync <Badge variant="neutral">Coming soon</Badge>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardContent>
              <h2 className="text-[15px] font-semibold">People</h2>
              <ul className="mt-3 flex flex-col gap-3">
                {participants.map((p) => (
                  <li key={p.userId} className="flex items-center gap-3">
                    <Avatar name={p.name} src={p.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link href={p.role === "consultant" ? `/consultants/${p.handle}` : `/people/${p.handle}`} className="flex items-center gap-1.5 truncate text-sm font-medium hover:underline">
                        {p.name} {p.userId === viewer.userId && <span className="text-muted">(you)</span>} {p.isDemo && <DemoBadge />}
                      </Link>
                      <p className="text-xs text-muted capitalize">{p.role}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {detail.startup && <p className="mt-4 text-[13px] text-muted">Booked for {detail.startup.name}</p>}
              {detail.conversationId ? (
                <Button asChild variant="secondary" size="sm" className="mt-4 w-full">
                  <Link href={`/messages/${detail.conversationId}`}>
                    <MessageCircle /> Open conversation
                  </Link>
                </Button>
              ) : (
                b.status === "pending_payment" && <p className="mt-4 text-xs text-subtle">A conversation opens once the booking is confirmed.</p>
              )}
            </CardContent>
          </Card>

          {viewerRole !== "teammate" && (
            <Card>
              <CardContent>
                <h2 className="text-[15px] font-semibold">Payment</h2>
                <dl className="mt-3 flex flex-col gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Price</dt>
                    <dd className="tabular-nums">{formatServicePrice(b.amountCents, b.currency, b.pricingType, detail.billingInterval)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 text-[13px]">
                    <dt className="text-muted">Platform fee (included)</dt>
                    <dd className="text-muted tabular-nums">{formatMoney(b.platformFeeCents, b.currency)}</dd>
                  </div>
                  {viewerRole === "consultant" && (
                    <div className="flex justify-between gap-3 border-t border-border pt-2 font-medium">
                      <dt>You receive</dt>
                      <dd className="tabular-nums">{formatMoney(b.amountCents - b.platformFeeCents, b.currency)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 text-[13px]">
                    <dt className="text-muted">Status</dt>
                    <dd className="capitalize">{payment ? `${payment.status}${payment.provider === "dev" ? " (test)" : ""}` : "Not paid"}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
          {client && viewerRole === "consultant" && (
            <p className="px-1 text-xs text-subtle">Clients can cancel for a full refund up to 24 hours before the session. You can cancel or refund any time before it starts.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Banner({ tone, icon, children }: { tone: "success" | "warning" | "neutral"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "mb-5 flex items-start gap-2.5 rounded-[14px] border p-4 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0",
        tone === "success" && "border-success/30 bg-success-soft text-success",
        tone === "warning" && "border-warning/30 bg-warning-soft text-warning",
        tone === "neutral" && "border-border bg-surface text-foreground",
      )}
    >
      {icon}
      <p>{children}</p>
    </div>
  );
}

function Timeline({ detail, tz }: { detail: Detail; tz: string }) {
  const b = detail.booking;
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
  const paid = detail.paymentHistory.some((p) => ["confirmed", "completed", "refunded", "disputed"].includes(p.status));
  const cancelledBy = detail.participants.find((p) => p.userId === b.cancelledById)?.name;
  const events: { label: string; at?: Date; done: boolean; tone?: "danger" }[] = [
    { label: "Booked", at: b.createdAt, done: true },
    { label: paid ? "Payment confirmed" : "Payment", done: paid },
    { label: "Session", at: b.startsAt, done: b.startsAt <= new Date() && b.status !== "cancelled" && b.status !== "pending_payment" },
  ];
  if (b.status === "completed" || b.completedAt) events.push({ label: "Completed", at: b.completedAt ?? undefined, done: true });
  if (b.cancelledAt) events.push({ label: `Cancelled${cancelledBy ? ` by ${cancelledBy}` : ""}${b.cancelReason ? ` — “${b.cancelReason}”` : ""}`, at: b.cancelledAt, done: true, tone: "danger" });
  if (b.status === "disputed") events.push({ label: "Dispute opened — the You&Me team is reviewing", done: true, tone: "danger" });
  if (b.status === "refunded") events.push({ label: "Refunded in full", done: true });

  return (
    <ol className="mt-4 flex flex-col gap-0">
      {events.map((e, i) => (
        <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
          {i < events.length - 1 && <span className="absolute top-5 left-[7px] h-[calc(100%-12px)] w-px bg-border" aria-hidden />}
          <span className={cn("mt-1 size-[15px] shrink-0 rounded-full border-2", e.done ? (e.tone === "danger" ? "border-danger bg-danger" : "border-brand bg-brand") : "border-border-strong bg-card")} aria-hidden />
          <div className="min-w-0">
            <p className={cn("text-sm", e.done ? "font-medium" : "text-muted")}>{e.label}</p>
            {e.at && <p className="text-xs text-muted">{fmt(e.at)}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
