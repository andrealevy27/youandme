import { redirect } from "next/navigation";
import { requireViewerPage } from "@/server/auth/session";

export default async function MyProfile() {
  const viewer = await requireViewerPage();
  redirect(`/people/${viewer.handle}`);
}
