import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { AuthBrandPanel } from "@/components/auth/brand-panel";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] lg:grid-cols-2 lg:gap-3 lg:p-3">
      <div className="flex min-h-dvh flex-col px-5 sm:px-10 lg:min-h-0">
        <header className="flex h-16 items-center justify-between lg:h-20">
          <Logo />
          <ThemeToggle />
        </header>
        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px] animate-fade-up">{children}</div>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-3 py-6 text-[12.5px] text-subtle">
          <p>© {new Date().getFullYear()} You&amp;Me</p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </nav>
        </footer>
      </div>
      <AuthBrandPanel />
    </div>
  );
}
