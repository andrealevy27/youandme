import Image from "next/image";
import { cn, initials } from "@/lib/utils";

const sizes = { xs: 24, sm: 32, md: 40, lg: 56, xl: 88, "2xl": 120 } as const;

/** Photography-first avatar with a tasteful initials fallback. */
export function Avatar({
  name,
  src,
  size = "md",
  className,
  rounded = "full",
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
  rounded?: "full" | "xl";
}) {
  const px = sizes[size];
  const radius = rounded === "full" ? "rounded-full" : "rounded-[18px]";
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={px}
        height={px}
        className={cn("shrink-0 object-cover bg-surface", radius, className)}
        style={{ width: px, height: px }}
        unoptimized={src.startsWith("/uploads/")}
      />
    );
  }
  // Deterministic hue from the name keeps fallbacks varied but stable.
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      role="img"
      aria-label={name}
      className={cn("inline-flex shrink-0 items-center justify-center font-semibold text-white select-none", radius, className)}
      style={{
        width: px,
        height: px,
        fontSize: Math.max(10, px * 0.36),
        background: `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${(hue + 40) % 360} 60% 32%))`,
      }}
    >
      {initials(name) || "?"}
    </span>
  );
}
