"use client";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("ym-theme", next ? "dark" : "light");
    } catch {}
  }
  return (
    <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Toggle dark mode" className={className}>
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}
