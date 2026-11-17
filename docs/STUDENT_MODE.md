# FoundMate student mode

Student mode turns FoundMate into a campus cofounder-matching product for student founders
(NYU and Stanford to start). It is controlled by one environment variable:

```
STUDENT_MODE=true    # student product
STUDENT_MODE=false   # original product (default)
```

Nothing is deleted in either direction. Hidden features (consultants, AI, startup profiles,
needs, bookings) stay in the code and come back when the flag is off.

## What changes when it's on

| Area | Student mode |
|---|---|
| Landing page | "Find your cofounder on campus — and across campuses", demo link, events pitch, privacy note |
| Sign-up | School emails only (`src/lib/schools.ts`); `ADMIN_EMAILS` are exempt |
| Visibility | Only students who confirmed their school email and opted in can see each other; "my school only" applies both ways |
| Onboarding | 7 screens: basics, skills, idea vs join, who you're looking for, hours + summer, 7-question quiz, visibility |
| Matches | Plain-language "Why you two" first; score is a small "x% overall fit" |
| Events | Admin > Events: create, QR code, projector view; attendees get 5 introductions at `/e/CODE` |
| Trials | After a match: 2-week trial with a six-conversation checklist and a continue/stop check-in |
| Demo | `/demo`: no sign-up, labelled sample students, real matching engine |
| Dashboard | Admin > Events: counts for a partner (students, attendees, matches, trials) |

## Adding a school

Add one line to `SCHOOLS` in `src/lib/schools.ts` (slug, name, short name, email domains).

## Requirements in production

- `RESEND_API_KEY` — needed to deliver school-email confirmations. Without it, students
  can't verify and won't see each other.
- `ADMIN_EMAILS` — your email, so you can sign up without a school address and run events.
- Run migrations (`npm run db:migrate`). Student mode adds only new tables and nullable
  columns (migrations 0002–0005); the original product ignores them.

## Turning it off

Set `STUDENT_MODE=false` (or remove it) and redeploy. Student data stays in the database,
unused, and reappears if you turn the flag back on.
