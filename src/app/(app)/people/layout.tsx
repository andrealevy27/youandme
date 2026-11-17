import { VerifiedStudentGate } from "@/components/student/verify-gate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <VerifiedStudentGate>{children}</VerifiedStudentGate>;
}
