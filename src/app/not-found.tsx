import type { Metadata } from "next";
import { Logo } from "@/components/shell/logo";
import { NotFoundContent } from "@/components/marketing/not-found-content";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 sm:px-8">
        <div className="mx-auto flex h-16 max-w-6xl items-center">
          <Logo />
        </div>
      </header>
      <main id="main" className="flex flex-1 items-center justify-center">
        <NotFoundContent />
      </main>
    </div>
  );
}
