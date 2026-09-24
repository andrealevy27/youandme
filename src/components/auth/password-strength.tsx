import { cn } from "@/lib/utils";

export const MIN_PASSWORD = 10;

export function passwordScore(pw: string) {
  if (pw.length < MIN_PASSWORD) return 0;
  let score = 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 14) score++;
  return Math.min(score, 4);
}

const labels = ["", "Okay", "Good", "Strong", "Very strong"];

/** Four-segment strength meter with a plain-language hint. */
export function PasswordStrength({ value, id }: { value: string; id: string }) {
  const score = passwordScore(value);
  const remaining = MIN_PASSWORD - value.length;
  return (
    <div id={id} className="mt-1" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full bg-border transition-colors",
              score >= i && (score >= 3 ? "bg-success" : score === 2 ? "bg-brand" : "bg-warning"),
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[12.5px] text-muted">
        {value.length === 0
          ? `At least ${MIN_PASSWORD} characters.`
          : remaining > 0
            ? `${remaining} more character${remaining === 1 ? "" : "s"} to go.`
            : `${labels[score]}${score < 3 ? " — mixing cases, numbers or symbols makes it stronger." : "."}`}
      </p>
    </div>
  );
}
