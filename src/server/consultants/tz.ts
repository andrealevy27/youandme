/**
 * Minimal, dependency-free timezone helpers built on Intl. Pure functions —
 * safe to unit test and to import from anywhere on the server.
 *
 * A "local date" is an ISO `YYYY-MM-DD` string in some IANA timezone.
 */

export type LocalDate = string;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** Wall-clock parts of an instant in a timezone. */
export function getZonedParts(date: Date, tz: string): ZonedParts {
  const parts = formatter(tz).formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") % 24, minute: get("minute"), second: get("second") };
}

/** Offset (ms) of `tz` from UTC at the given instant: local = utc + offset. */
export function tzOffsetMs(date: Date, tz: string): number {
  const p = getZonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - truncated;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toLocalDate(date: Date, tz: string): LocalDate {
  const p = getZonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function parseLocalDate(d: LocalDate): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new Error(`Invalid local date: ${d}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function addDays(d: LocalDate, n: number): LocalDate {
  const { year, month, day } = parseLocalDate(d);
  const t = new Date(Date.UTC(year, month - 1, day + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Sunday … 6 = Saturday (matches consultant_availability.weekday). */
export function weekdayOf(d: LocalDate): number {
  const { year, month, day } = parseLocalDate(d);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Convert a wall-clock time (`minuteOfDay` on local date `d` in `tz`) to a UTC instant.
 * Returns null when that wall-clock time does not exist (the spring-forward gap).
 * For ambiguous times (fall-back overlap) the earlier instant is returned.
 */
export function zonedTimeToUtc(d: LocalDate, minuteOfDay: number, tz: string): Date | null {
  const { year, month, day } = parseLocalDate(d);
  const wall = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  // Try both candidate offsets (the offset just before and just after the wall time).
  const candidates = new Set<number>();
  for (const probe of [wall - 36e5 * 14, wall, wall + 36e5 * 14]) {
    candidates.add(wall - tzOffsetMs(new Date(probe), tz));
  }
  // Also refine iteratively from the naive guess.
  const o1 = tzOffsetMs(new Date(wall), tz);
  candidates.add(wall - o1);
  candidates.add(wall - tzOffsetMs(new Date(wall - o1), tz));

  const valid = [...candidates]
    .filter((t) => {
      const p = getZonedParts(new Date(t), tz);
      return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) === wall;
    })
    .sort((a, b) => a - b);
  return valid.length ? new Date(valid[0]!) : null;
}

/** UTC instant of local midnight (or the first existing minute) on `d`. */
export function startOfLocalDay(d: LocalDate, tz: string): Date {
  for (let m = 0; m < 180; m += 15) {
    const t = zonedTimeToUtc(d, m, tz);
    if (t) return t;
  }
  throw new Error(`Could not resolve start of ${d} in ${tz}`);
}

export function formatMinuteOfDay(minute: number): string {
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

export function parseTimeToMinute(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min !== 0)) return null;
  return h * 60 + min;
}
