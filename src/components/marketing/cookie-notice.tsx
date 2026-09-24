"use client";
import * as React from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

const KEY = "ym-cookie-notice-dismissed";
const EVENT = "ym-cookie-notice";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function isDismissed() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true; // Storage blocked — don't nag on every page.
  }
}

/**
 * Informational only: You&Me uses essential cookies (sign-in) and stores the
 * theme preference locally. There are no advertising or tracking cookies, so
 * there is nothing to opt in or out of.
 */
export function CookieNotice() {
  const dismissed = React.useSyncExternalStore(subscribe, isDismissed, () => true);
  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-3 z-50 animate-fade-up sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-sm"
    >
      <div className="flex items-start gap-3 rounded-[16px] border border-border bg-elevated p-4 shadow-float">
        <Cookie className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
        <p className="flex-1 text-[13px] leading-relaxed text-muted">
          We only use essential cookies to keep you signed in. No ads, no trackers.{" "}
          <Link href="/privacy#cookies" className="font-medium text-foreground underline-offset-4 hover:underline">
            Learn more
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="-m-1 rounded-full p-1 text-subtle transition-colors hover:bg-surface hover:text-foreground"
          aria-label="Dismiss cookie notice"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
