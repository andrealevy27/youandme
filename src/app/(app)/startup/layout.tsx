import { StudentModeGate } from "@/components/student/coming-soon";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StudentModeGate feature="Startup profiles">{children}</StudentModeGate>;
}
