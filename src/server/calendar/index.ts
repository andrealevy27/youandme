/**
 * Calendar integration architecture (not wired up yet — the UI shows "Coming soon").
 *
 * A consultant connects a calendar once; `consultant_profiles.calendarProvider` +
 * `calendarConnectionId` point at the stored OAuth connection. Once implemented:
 *   1. `getAvailableSlots` subtracts `listBusy()` intervals from generated slots.
 *   2. On booking confirmation, `createEvent()` stores the id in `bookings.calendarEventId`.
 *   3. On cancel/refund, `cancelEvent()` removes it.
 *
 * TODO(calendar): implement GoogleCalendarProvider (OAuth + freeBusy + events.insert),
 * token storage (encrypted) and a connect/disconnect flow in the consultant workspace.
 * Until then, bookings offer a real .ics download (/api/v1/bookings/[id]/ics).
 */

export type CalendarBusyInterval = { startsAt: Date; endsAt: Date };

export type CalendarEventInput = {
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  attendeeEmails: string[];
};

export interface CalendarProvider {
  readonly name: "google" | "outlook";
  listBusy(connectionId: string, from: Date, to: Date): Promise<CalendarBusyInterval[]>;
  createEvent(connectionId: string, event: CalendarEventInput): Promise<{ eventId: string }>;
  cancelEvent(connectionId: string, eventId: string): Promise<void>;
}

/** No calendar providers are available yet; callers must treat null as "not connected". */
export function getCalendarProvider(_name: string | null | undefined): CalendarProvider | null {
  return null;
}

export const CALENDAR_SYNC_AVAILABLE = false;
