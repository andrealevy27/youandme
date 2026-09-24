"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Result } from "./types";

type Status =
  | { configured: false }
  | { configured: true; connected: false }
  | { configured: true; connected: true; chargesEnabled: boolean; detailsSubmitted: boolean; payoutsEnabled: boolean };

export function PayoutsPanel({
  status,
  devPayments,
  connect,
  dashboard,
  refresh,
}: {
  status: Status;
  devPayments: boolean;
  connect: () => Promise<Result<{ url: string }>>;
  dashboard: () => Promise<Result<{ url: string }>>;
  refresh: () => Promise<Result<unknown>>;
}) {
  const [pending, start] = useTransition();
  const go = (fn: () => Promise<Result<{ url: string }>>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      window.location.href = res.data.url;
    });

  if (!status.configured) {
    return (
      <div className="text-sm">
        <p className="font-medium">Payments aren&apos;t configured on this environment.</p>
        <p className="mt-1 text-muted">
          {devPayments
            ? "Test payments are enabled here, so founders can book you without real money moving. Payouts via Stripe will appear once it's configured."
            : "Founders can't pay for bookings here yet. They can still message you."}
        </p>
      </div>
    );
  }
  if (!status.connected) {
    return (
      <div className="text-sm">
        <p className="text-muted">Connect a Stripe account to get paid. You&amp;Me keeps a transparent platform fee; the rest goes straight to you.</p>
        <Button className="mt-3" loading={pending} onClick={() => go(connect)}>
          Set up payouts with Stripe
        </Button>
      </div>
    );
  }
  return (
    <div className="text-sm">
      {status.chargesEnabled ? (
        <p className="font-medium text-success">Payouts active — founders can book and pay you.</p>
      ) : (
        <p className="font-medium text-warning">Onboarding not finished — founders can&apos;t pay you yet.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!status.chargesEnabled && (
          <Button loading={pending} onClick={() => go(connect)}>
            Continue onboarding
          </Button>
        )}
        {status.chargesEnabled && (
          <Button variant="secondary" loading={pending} onClick={() => go(dashboard)}>
            Stripe dashboard <ExternalLink />
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await refresh();
              if (!res.ok) return void toast.error(res.error);
              toast.success("Status refreshed");
            })
          }
        >
          <RefreshCw /> Refresh status
        </Button>
      </div>
    </div>
  );
}
