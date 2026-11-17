"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";

const noopSubscribe = () => () => {};

/**
 * A datetime-local input whose value is converted in the browser: the form posts `name` as an
 * ISO timestamp and `timezone` as the browser's IANA zone, so the server never guesses.
 */
export function LocalDateTimeInput({ id, name }: { id: string; name: string }) {
  const [local, setLocal] = React.useState("");
  // Browser-only value; the server snapshot is empty and the client fills it in after hydration.
  const tz = React.useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <>
      <Input id={id} type="datetime-local" required value={local} onChange={(e) => setLocal(e.target.value)} />
      <input type="hidden" name={name} value={iso} />
      <input type="hidden" name="timezone" value={tz} />
    </>
  );
}
