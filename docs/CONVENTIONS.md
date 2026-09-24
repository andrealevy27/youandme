# Engineering conventions

## Layering
- `src/server/**` holds business logic. Services take a `viewerId` (or `Viewer`) plus validated input and enforce authorization themselves. Never import `src/server/**` from a `"use client"` file.
- Pages are async server components. Protect them with `requireViewerPage()` (already done by `(app)/layout.tsx`, but call it again in the page to get the viewer — it's `cache()`d).
- Mutations use **server actions** in a colocated `actions.ts` (`"use server"`), always shaped like:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { doThing } from "@/server/feature";

const input = z.object({ id: z.string().uuid() });

export async function doThingAction(raw: z.input<typeof input>) {
  return runAction(async () => {
    const viewer = await requireViewer();
    const data = input.parse(raw);
    const result = await doThing(viewer.userId, data);
    revalidatePath("/feature");
    return result;
  });
}
```
  Client components call the action, check `res.ok`, and show `toast.error(res.error)` (sonner) on failure.
- Mobile-ready JSON endpoints live under `src/app/api/v1/**/route.ts`, use `getViewerFromHeaders(req.headers)` and the same services, and return `{ error }` with `HTTP_STATUS[code]` on `AppError`.
- Throw `AppError` (from `@/server/errors`) with human-readable messages. Never leak stack traces; unknown errors are logged and replaced.

## UI
- Primitives: `@/components/ui/*` (Button, Card, Badge, DemoBadge, Avatar, Input/Textarea/NativeSelect/Field, Dialog, DropdownMenu, Tabs, Switch, Tooltip, Progress/ScoreRing, Skeleton/CardSkeleton, EmptyState/ErrorState, Chip/OptionCard, PageHeader/SectionHeader).
- Tokens: `bg-background`, `bg-surface`, `bg-card`, `border-border`, `text-foreground`, `text-muted`, `text-subtle`, `bg-brand`, `text-brand-ink`, `bg-brand-soft`, `bg-ink text-ink-foreground`, `text-success/warning/danger` + `-soft` backgrounds. Utilities: `bg-brand-gradient`, `text-gradient`, `shadow-soft`, `shadow-float`, `animate-fade-up`.
- Card radius 16px, buttons 10px. Generous spacing. Accent colour sparingly.
- Every list has an `EmptyState` with a useful next step. Use `loading.tsx` with skeletons, never full-page spinners. Use `error.tsx` with a friendly message + retry.
- Demo records (`isDemo`) must show `<DemoBadge />`.
- Mobile first: layouts must work at 360px. The app shell adds bottom padding for the mobile tab bar.
- Accessibility: labelled controls (`Field`), `aria-pressed`/`aria-current`, alt text, focus-visible styles, keyboard reachable.

## Honesty rules (product requirements)
Never show fake metrics, reviews, matches, availability or notifications. Hide or clearly label unavailable features ("Coming soon"). Every visible CTA must work.

## Copy
Concise, human, confident, founder-native. "Five people worth meeting." Not "Leverage synergies."

## Analytics
`track("event_name", userId, props)` from `@/server/analytics`; event names are defined in `src/lib/analytics-events.ts`.
