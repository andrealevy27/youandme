# You&Me

**The network for building startups.** Tell You&Me what you're building — it helps you find the people you need to build it: cofounders, consultants, advisors and startup talent, intelligently matched and explained.

## What's inside

- **Progressive onboarding** — one question per screen, adapts to what brings you here.
- **Cofounder matching** — five curated recommendations a day, each with an explained compatibility score, strengths, complementary skills and potential friction. Mutual interest creates a match and a conversation.
- **Working-style quiz** — 21 statements across seven dimensions (visionary↔operator, fast↔deliberate, …) used in matching. Not a clinical assessment.
- **Startups** — profiles, teams with role-based permissions, invites, needs and open roles, team group chat.
- **Consultant marketplace** — AI-assisted "describe what you need" search, services (fixed, hourly, package, monthly), real availability, booking with teammates, Stripe Connect payments, verified reviews.
- **You&Me AI** — a concierge that answers only from real profiles via controlled, permission-aware tools, plus team-gap detection.
- **Messaging** — direct, match, consultant, booking and startup group threads with reactions, attachments, read receipts and typing indicators.
- **Trust & safety** — honest verification badges, reports, blocks, moderation queue, audit log.
- **Admin** — permission-based dashboard with real metrics, moderation, marketplace ops, growth (waitlist/invites) and platform settings (matching weights, commission).

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the architecture, sitemap and data model.

## Getting started

Requirements: Node 22+, PostgreSQL 16.

```bash
npm install
cp .env.example .env            # fill in BETTER_AUTH_SECRET (openssl rand -base64 32)
createdb youandme               # or point DATABASE_URL at your database
npm run db:migrate
npm run db:seed                 # reference data + clearly-labelled DEMO data (dev only)
npm run dev
```

Demo sign-in (development only): `lisa@demo.youandme.app` / `demo-password-123`. The admin demo account is `admin@demo.youandme.app` (granted `super_admin` via `ADMIN_EMAILS`). Demo people and startups carry a visible **Demo** badge and are never seeded when `NODE_ENV=production`.

### Integrations

Every integration is optional in development and is hidden or clearly labelled when not configured — never faked:

| Integration | Env | When missing |
|---|---|---|
| Google / Apple / LinkedIn sign-in | `*_CLIENT_ID`, `*_CLIENT_SECRET` | Buttons hidden |
| Claude (You&Me AI, explanation writing) | `ANTHROPIC_API_KEY`, `AI_MODEL` | "Basic mode" label; rule-based answers from real data |
| Stripe Connect | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Paid booking unavailable (set `PAYMENTS_PROVIDER=dev` locally for a labelled no-charge test mode; refused in production) |
| Resend | `RESEND_API_KEY` | Emails logged to the server console |
| S3-compatible storage | `STORAGE_DRIVER=s3`, `S3_*` | Local `./uploads` (dev) |
| PostHog | `POSTHOG_KEY`, `POSTHOG_HOST` | Events still stored in `analytics_events` |

## Deploying to youandme.company

1. Create a Postgres database (e.g. Neon or Supabase).
2. Import the GitHub repo into Vercel and set these environment variables:
   - `DATABASE_URL`: the database connection string.
   - `BETTER_AUTH_SECRET`: output of `openssl rand -base64 32`.
   - `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`: `https://youandme.company`.
   - `ADMIN_EMAILS`: the founders' emails; these accounts get the admin dashboard.
   - `RESEND_API_KEY`: from Resend, after verifying `youandme.company` as a sending domain there.
   - `EMAIL_FROM`: `You&Me <hello@youandme.company>`.
3. In Vercel → Domains, add `youandme.company` and update the DNS records it shows.
4. Run `npm run db:migrate` once against the production `DATABASE_URL`.
5. Sign up at `/signup` with an `ADMIN_EMAILS` address **before** turning on invite-only.

Links once live: waitlist at https://youandme.company/waitlist, admin at https://youandme.company/admin/growth.

## Pre-launch waitlist

Run You&Me as a waitlist until launch, from **Admin → Growth**:

1. Turn on **Waitlist-only site**: signed-out visitors then only see the waitlist form (at `/` and `/waitlist`), and sign-up needs an invite. Admins and members can still sign in at `/login`. (Alternatively, **Invite-only** + **Waitlist** keep the full marketing site but point its CTAs to `/waitlist`.)
2. The form asks for name and email (required), plus optional phone, school, how they heard about you and what brings them. Sign-ups get a confirmation email (set `RESEND_API_KEY`; without it, emails are only logged).
3. Let people in with **Invite the next wave** (longest-waiting first, up to 100 at a time) or per person. Each gets a single-use code valid for 30 days, and their entry flips to *joined* when they sign up.
4. **Export CSV** downloads the whole list.
5. At launch, turn the switches off to show the full site and open sign-ups.

## Scripts

| Command | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | TypeScript strict, ESLint |
| `npm run test:unit` | Pure logic (matching engine, permissions, slots, pricing, …) |
| `npm run test:integration` | Services against a real Postgres (`youandme_test`, truncated per test) |
| `npm run test:e2e` | Playwright against the seeded dev database |
| `npm run db:generate` / `db:migrate` / `db:seed` | Drizzle migrations and seed |

## Project layout

```
src/app          routes (marketing, auth, onboarding, app, admin, api)
src/components   design system (ui/) and feature components
src/server       business logic: auth, authz, matching, recommendations, consultants,
                 bookings, payments, messaging, ai, search, privacy, admin, …
src/lib          shared vocabulary, personality model, utilities
drizzle/         SQL migrations
tests/           unit, integration, e2e
```
