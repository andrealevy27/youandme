"use client";
import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({ className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} className={cn("pr-11", className)} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[10px] text-subtle transition-colors hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function AuthHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">{title}</h1>
      {description && <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[10px] border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger">
      {message}
    </p>
  );
}
