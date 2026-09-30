"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";

export function MobileMenu({
  links,
  signedIn,
  cta,
}: {
  links: readonly { href: string; label: string }[];
  signedIn: boolean;
  cta: { href: string; label: string };
}) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X /> : <Menu />}
      </Button>
      {open &&
        createPortal(
          <div
            id="mobile-menu"
            className="fixed inset-x-0 top-16 bottom-0 z-50 animate-fade-up overflow-y-auto border-t border-border bg-background px-5 pt-4 pb-10"
          >
            <ul className="flex flex-col">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex h-14 items-center border-b border-border text-[20px] font-medium tracking-tight"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3">
              {signedIn ? (
                <Button asChild size="lg">
                  <Link href="/home" onClick={() => setOpen(false)}>
                    Open app
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href={cta.href} onClick={() => setOpen(false)}>
                      {cta.label}
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary">
                    <Link href="/login" onClick={() => setOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                </>
              )}
            </div>
            <div className="mt-8 flex items-center justify-between text-[13px] text-muted">
              <span>Appearance</span>
              <ThemeToggle />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
