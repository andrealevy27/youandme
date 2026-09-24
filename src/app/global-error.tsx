"use client";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

/** Last-resort boundary: replaces the root layout, so it renders its own <html>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="min-h-dvh font-sans">
        <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center">
          <svg viewBox="0 0 32 32" className="size-9" aria-hidden>
            <circle cx="12" cy="16" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.6" />
            <circle cx="20" cy="16" r="8.5" fill="none" stroke="#4b3bf0" strokeWidth="2.6" />
          </svg>
          <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.03em]">Something went wrong on our side.</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            It&apos;s not you. Please try again — if it keeps happening, we&apos;re already looking into it.
          </p>
          {error.digest && <p className="mt-3 font-mono text-[12px] text-subtle">Reference: {error.digest}</p>}
          <div className="mt-8 flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-11 items-center rounded-[10px] bg-ink px-5 text-sm font-medium text-ink-foreground hover:opacity-90"
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- router may be unavailable here */}
            <a href="/" className="inline-flex h-11 items-center rounded-[10px] border border-border-strong px-5 text-sm font-medium hover:bg-surface">
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
