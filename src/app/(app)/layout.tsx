import { AppShell } from "@/components/shell/app-shell";
import { requireViewerPage } from "@/server/auth/session";
import { touchLastActive } from "@/server/people/activity";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewerPage();
  await touchLastActive(viewer.userId);
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
