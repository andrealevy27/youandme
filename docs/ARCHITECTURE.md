# You&Me — Architecture

> The network for building startups. Tell You&Me what you're building; we help you find the people you need to build it.

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, RSC, server actions), React 19, TypeScript strict | One deployable, server-first rendering, typed end to end |
| Styling | Tailwind CSS v4 + CSS-variable design tokens, Radix primitives (`radix-ui`), shadcn-style local components | Full control of a premium, non-template look; accessible primitives |
| Database | PostgreSQL 16 | Relational data, full-text search today, pgvector later |
| ORM | Drizzle ORM + drizzle-kit migrations | SQL-shaped, zero runtime engine, typed |
| Auth | Better Auth (email/password, Google, Apple, LinkedIn) with DB sessions | Self-hosted, Drizzle adapter, rate limiting, hooks for invite-only + moderation |
| Payments | Stripe Connect (Checkout + destination charges + `application_fee_amount`) behind a `PaymentProvider` interface | Marketplace commission, no card data stored |
| Email | Resend behind `EmailProvider` (console logging when unconfigured) | |
| Storage | `StorageDriver` interface — local disk (dev) / S3-compatible (prod) | |
| Realtime | Short-polling API (`/api/v1/conversations/:id/messages?after=`) — Pusher-ready interface | Works everywhere without extra infra |
| AI | `AIProvider` interface; Anthropic implementation (Claude, adaptive thinking, server-side refusal fallback); "basic mode" when no key | Swappable provider; never fabricates results |
| Analytics | `track()` → `analytics_events` table (+ optional PostHog) | Admin metrics use first-party data only |
| Tests | Vitest (unit + integration against real Postgres), Playwright (E2E) | |

## 2. Folder structure

```
src/
  app/
    (marketing)/          landing, privacy, terms, waitlist, invite
    (auth)/               login, signup, forgot/reset password
    (app)/                authenticated product (AppShell: sidebar / bottom nav)
      home, matches, discover, consultants, ai, messages, startup(s), people,
      profile, quiz, saved, notifications, bookings, consultant (workspace), settings
    onboarding/           progressive onboarding (outside AppShell)
    admin/                permission-gated admin panel
    api/                  auth, v1 REST (mobile-ready), webhooks, uploads
  components/
    ui/                   design-system primitives (Button, Card, Dialog, …)
    shell/                app chrome
    <feature>/            feature components (matching, consultants, messaging, …)
  lib/                    isomorphic: domain vocabulary, personality model, utils, validation
  server/                 ALL business logic (framework-agnostic, never imported by client code)
    db/ (schema, migrate, seed)   auth/   authz/   matching/   recommendations/
    people/  startups/  consultants/  bookings/  payments/  messaging/
    notifications/  ai/  search/  privacy/  moderation/  admin/  analytics/
    email/  storage/  settings.ts  audit.ts  rate-limit.ts  errors.ts  env.ts
```

**Rule:** UI never contains business rules. Pages/server actions/API routes are thin: authenticate → validate (zod) → call a `server/*` service with the viewer's id → render. Services enforce authorization themselves, so web, API and a future native app share identical rules.

## 3. Sitemap

Public: `/` · `/login` · `/signup` · `/forgot-password` · `/waitlist` · `/invite/[code]` · `/privacy` · `/terms`

App:
- `/onboarding` — progressive, one question per screen
- `/home` — personalised dashboard
- `/matches` — five daily cofounder recommendations · `/matches/connections` — mutual matches, likes, saved
- `/discover` — people, founders, cofounders, consultants, startups, talent (keyword + filters)
- `/consultants` — marketplace + "describe what you need" · `/consultants/[handle]` · `/consultants/[handle]/book/[serviceId]`
- `/ai` — You&Me AI concierge
- `/messages` · `/messages/[id]` — direct, match, consultant, startup group, booking threads
- `/people/[handle]` — profile (context-aware CTA) · `/profile` → own profile · `/profile/edit`
- `/quiz` · `/working-style` — working-style quiz and results
- `/startup` → your startups · `/startups/new` · `/startups/[slug]` · `/startups/[slug]/edit` · `/startups/[slug]/team`
- `/needs` — what you need right now
- `/saved` · `/notifications` · `/bookings` · `/bookings/[id]`
- `/consultant` — consultant workspace (profile, services, availability, payouts)
- `/settings` — account, notifications, privacy & visibility, data export, delete account

Admin (`/admin`, permission-based): overview analytics · users · consultants · startups · reports · bookings & payments · categories · reviews · verification · waitlist & invites · settings (matching weights, commission, invite-only) · audit log

## 4. Data model (summary)

See `src/server/db/schema/*`. Highlights:

- **Identity:** `user/session/account/verification` (Better Auth) · `profiles` (1:1, soft delete + anonymisation, visibility, status) · `user_roles` (text; extensible) · `experiences` · `educations` · `skills`/`user_skills` · `industries`/`user_industries`
- **Startups:** `startups` · `startup_industries` · `startup_members` (role + `is_admin`) · `startup_invites` · `open_roles` · `needs` + `need_skills`
- **Working style:** `personality_questions` · `personality_answers` · `personality_profiles` (scores per dimension, −100…100)
- **Matching:** `match_preferences` · `recommendations` (daily, stored for stability) · `interests` (interested/passed) · `matches` · `compatibility_results` (cache)
- **Marketplace:** `consultant_categories` (admin-extensible) · `consultant_profiles` · `consultant_profile_categories` · `consultant_services` (fixed/hourly/package/recurring) · `consultant_availability` (weekly rules) · `consultant_time_off` · `bookings` (price snapshot; partial unique index prevents double booking) · `booking_participants` · `payments` (provider IDs only) · `reviews` (one per completed booking)
- **Social:** `connections` · `follows` · `saved_collections`/`saved_items` · `conversations`/`conversation_members`/`messages`/`message_reactions` · `notifications`/`notification_preferences`
- **Trust & platform:** `identity_verifications` · `reports` (with content snapshot) · `blocks` · `platform_invites` · `waitlist_entries` · `platform_settings` · `admin_users` · `audit_logs` · `analytics_events` · `ai_threads`/`ai_messages` · `file_uploads` · `subscriptions` (Pro — dormant)

Relationship states are distinct tables, never overloaded: **follow** (one-way) · **connection** (mutual professional) · **interest** (one-way cofounder signal) · **match** (mutual interest) · **startup member** · **booking participant** (consultant relationship).

## 5. Matching engine

`server/matching/engine.ts` — pure function `scoreCompatibility(viewer, candidate, weights)` implementing `CompatibilityScorer`:

| Factor | Default weight | Signal |
|---|---|---|
| Skill complementarity | 25 | candidate covers categories the viewer seeks (and vice-versa), overlap penalty |
| Goal alignment | 15 | ambition (venture / profitable / impact / open) + stage preferences |
| Commitment | 15 | ordinal distance |
| Industry | 10 | shared industries |
| Personality | 15 | quiz: similar on pace & risk, complementary on visionary/operator & big-picture/detail |
| Working style | 10 | quiz: similar on structure, autonomy, communication |
| Location / remote | 5 | city/country/work mode |
| Availability | 5 | hours/week ordinal distance |

Weights live in `platform_settings.match_weights` (admin-editable). Output: overall score, factor scores with `known` flags (missing data → neutral, never a strength or friction), strengths, friction points, shared interests, complementary skills and an explanation. An ML model can replace it by implementing `CompatibilityScorer`.

**Daily recommendations** (`server/recommendations`): candidate SQL pre-filter (discoverable, seeking cofounders, not blocked, not matched, not already liked, not passed within the cooldown) ordered by activity and capped at 300 → batch-load profiles → score → re-rank (activity, completeness, recent-repeat penalty) → top N (default 5) stored per user per local day. Explanations are rewritten by the AI provider using *only* the structured facts when configured; otherwise the deterministic template is used.

## 6. AI architecture

The concierge never touches tables directly. It can only call controlled tools in `server/ai/tools.ts` — `searchPeople`, `searchConsultants`, `getStartupContext`, `getUserNeeds`, `getMatches`, `getStartupTeam`, `analyzeTeamGaps` — each of which runs as the viewer, applies visibility/block rules and returns sanitised public fields. Result cards rendered in the UI come from IDs returned by tools, so a profile the model invents can never be displayed. Without an API key, "basic mode" parses intent with rules and calls the same tools.

## 7. Security

- Server-side authorization everywhere (`requireViewer`, `requireAdmin(permission)`, `canOnStartup`, `assertMember`); UI checks are cosmetic only.
- Better Auth: scrypt password hashing, secure cookies, CSRF-safe origin checks, built-in rate limits on auth endpoints; app-level rate limits for messages, AI, search, reports, bookings, uploads.
- Suspended/banned accounts blocked at session creation and at every viewer load.
- Zod validation on every server action and API route; URLs sanitised before rendering.
- Uploads: MIME allow-list + size limit + random keys.
- Audit log for admin actions, account deletion, payments/refunds, permission changes.
- Security headers (HSTS, frame-deny, nosniff, referrer policy).

## 8. Implementation sequence

1. Schema, auth, permissions, core services (done first) → 2. design system + shell → 3. onboarding → 4. profiles & startups → 5. quiz → 6. matching + daily recommendations → 7. consultants, services, availability, booking, payments, reviews → 8. messaging + group chats → 9. AI concierge → 10. notifications, saved, moderation → 11. admin → 12. tests → 13. responsive/empty/loading/error polish.

## 9. Environment & integrations

See `.env.example`. Missing optional integrations are **hidden or clearly labelled**, never faked:
- No OAuth keys → provider buttons hidden.
- No `ANTHROPIC_API_KEY` → AI shows "basic mode" label.
- No Stripe → paid booking disabled with an explanation; `PAYMENTS_PROVIDER=dev` (refused in production) completes bookings with a visible "test mode — no charge" banner.
- No Resend → emails logged server-side.

## 10. Status & known follow-ups

Verified: `tsc` strict (0 errors), ESLint (0 problems), 131 unit + 26 integration tests (real Postgres), 9 Playwright E2E tests, `next build`.

Not yet exercised against live providers (no credentials in the build environment): Stripe Checkout/Connect/webhooks, Claude (AI concierge full mode, AI-written explanations), Resend, S3, Google/Apple/LinkedIn OAuth. Each is implemented behind its interface and degrades honestly when unconfigured.

Follow-ups:
- Schema: `payment_events` table (unique provider event id) for strict webhook de-duplication; `bookings.group_chat` and `bookings.billing_interval` snapshots (currently in payment metadata / read from the service).
- Realtime: Pusher (or similar) transport behind `server/realtime` — messaging currently short-polls.
- Rate limiting is in-memory per instance; move the store to Redis for multi-instance deploys.
- Calendar sync (Google) is a documented stub; bookings offer `.ics` downloads today.
- Admin: dispute resolution screen (the `resolve_dispute` transition exists), detail views for startups/reports/bookings.
- Hourly services book one hour at a time; multi-hour quantity is not exposed yet.
- Consultants whose profile visibility is "members" still appear in the public marketplace (only "hidden" is excluded) — decide the intended policy.
- Semantic search: `SemanticIndex` seam exists (`server/search/semantic.ts`); add pgvector embeddings for bios, startup descriptions, expertise and needs.
- You&Me Pro entitlements are gated off (`pro_enabled`); no paid features are active.
