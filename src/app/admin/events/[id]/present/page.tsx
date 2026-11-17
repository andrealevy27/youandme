import { notFound } from "next/navigation";
import { LogoMark } from "@/components/shell/logo";
import { requireAdminPage } from "@/server/auth/session";
import { formatEventTime, getEventById } from "@/server/events";
import { eventJoinUrl, eventQrSvg } from "@/server/events/links";

export const metadata = { title: "Present" };

/** Projector view: big QR code and join code, nothing else. */
export default async function PresentEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("events.manage");
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();
  const qr = await eventQrSvg(event.code);
  const url = eventJoinUrl(event.code).replace(/^https?:\/\//, "");
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background p-8 text-center">
      <div>
        <p className="inline-flex items-center gap-2 text-[15px] font-medium text-brand-ink">
          <LogoMark className="size-5" /> FoundMate
        </p>
        <h1 className="mt-3 text-[40px] leading-tight font-semibold tracking-tight sm:text-[56px]">{event.name}</h1>
        <p className="mt-2 text-lg text-muted">{formatEventTime(event)}</p>
      </div>
      <div className="w-[min(60vh,80vw)] rounded-[24px] bg-white p-4 shadow-float" dangerouslySetInnerHTML={{ __html: qr }} role="img" aria-label="QR code to join" />
      <div>
        <p className="text-xl font-medium">Scan to meet your team tonight</p>
        <p className="mt-2 text-muted">
          or go to <span className="font-mono font-semibold text-foreground">{url}</span>
        </p>
      </div>
    </div>
  );
}
