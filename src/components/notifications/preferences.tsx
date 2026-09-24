import { requireViewer } from "@/server/auth/session";
import { getNotificationPreferenceMatrix } from "@/server/notifications";
import { NotificationPreferencesForm } from "./preferences-form";

/**
 * Notification settings (per type × channel). Async server component — mount it anywhere
 * in a signed-in server page, e.g. `/settings`: `<NotificationPreferences />`.
 */
export async function NotificationPreferences() {
  const viewer = await requireViewer();
  const rows = await getNotificationPreferenceMatrix(viewer.userId);
  return <NotificationPreferencesForm initial={rows} />;
}
