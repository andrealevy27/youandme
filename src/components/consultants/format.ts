/** Isomorphic formatting helpers for the marketplace (safe in client and server components). */
import { formatMoney } from "@/lib/utils";
import type { PricingType } from "@/lib/domain";

export function formatServicePrice(cents: number, currency: string, pricingType: PricingType, billingInterval?: string | null): string {
  const money = formatMoney(cents, currency);
  if (pricingType === "hourly") return `${money}/hr`;
  if (pricingType === "recurring") return `${money}/${billingInterval || "month"}`;
  return money;
}

export function pricingNote(pricingType: PricingType, billingInterval?: string | null): string {
  switch (pricingType) {
    case "fixed":
      return "One-off session";
    case "hourly":
      return "Billed per hour";
    case "package":
      return "Package";
    case "recurring":
      return `Billed every ${billingInterval || "month"} · cancel any time`;
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function formatRating(avg: number | null | undefined): string {
  return avg == null ? "–" : (Math.round(avg * 10) / 10).toFixed(1);
}

export function formatSlotTime(d: Date | string, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(d));
}

export function formatSlotDay(d: Date | string, tz: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(new Date(d));
}

/** Local YYYY-MM-DD of an instant in a timezone (for grouping slots by the viewer's day). */
export function localDayKey(d: Date | string, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
  return parts; // en-CA formats as YYYY-MM-DD
}

export function formatDateTimeRange(start: Date | string, end: Date | string, tz: string) {
  const s = new Date(start);
  const e = new Date(end);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(s);
  const t = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(s).find((p) => p.type === "timeZoneName")?.value ?? tz;
  return { day, time: `${t(s)} – ${t(e)}`, zone };
}

export function timezoneLabel(tz: string) {
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value;
  return zone ? `${zone} (${tz.replace(/_/g, " ")})` : tz;
}
