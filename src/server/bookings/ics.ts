/** Minimal RFC 5545 calendar file for a booking. Pure — easy to test. */

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Escape text values per RFC 5545 §3.3.11. */
export function escapeIcsText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold long lines at 75 octets (approximated by characters) per RFC 5545 §3.1. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildBookingIcs(input: {
  uid: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  url: string;
  organizerName: string;
  cancelled?: boolean;
  now?: Date;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//You&Me//Bookings//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${input.cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${input.uid}@youandme.company`,
    `DTSTAMP:${fmt(input.now ?? new Date())}`,
    `DTSTART:${fmt(input.startsAt)}`,
    `DTEND:${fmt(input.endsAt)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    `DESCRIPTION:${escapeIcsText(input.description)}`,
    `URL:${input.url}`,
    `ORGANIZER;CN=${escapeIcsText(input.organizerName)}:mailto:noreply@youandme.company`,
    `STATUS:${input.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
