"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

const EXAMPLE = "We are launching a consumer AI app and need someone who can help us build a TikTok acquisition strategy.";

/** The "Describe what you need" box. Submits to the URL so results are shareable and server-rendered. */
export function NeedSearch({ initial, aiEnabled }: { initial?: string; aiEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initial ?? "");
  const [pending, start] = useTransition();

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    next.delete("category");
    if (value.trim()) next.set("need", value.trim());
    else next.delete("need");
    start(() => router.push(`/consultants?${next.toString()}#results`));
  }

  return (
    <form onSubmit={submit} className="relative rounded-[20px] border border-border-strong bg-card p-2 shadow-float focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
      <label htmlFor="need" className="sr-only">
        Describe what you need
      </label>
      <Textarea
        id="need"
        name="need"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder={EXAMPLE}
        maxLength={2000}
        rows={3}
        className="min-h-28 resize-none border-0 bg-transparent text-[16px] shadow-none focus-visible:ring-0 sm:text-[17px]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1">
        <p className="inline-flex items-center gap-1.5 text-[12px] text-subtle">
          <Sparkles className="size-3.5" aria-hidden />
          {aiEnabled ? "Interpreted by You&Me AI — results are always real consultants." : "Basic mode — matched by keywords, budget and stage."}
        </p>
        <div className="flex items-center gap-2">
          {!value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setValue(EXAMPLE)}>
              Try the example
            </Button>
          )}
          <Button type="submit" variant="primary" loading={pending}>
            Find consultants <ArrowRight />
          </Button>
        </div>
      </div>
    </form>
  );
}
