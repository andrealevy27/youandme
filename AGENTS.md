<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# You&Me project notes

- Architecture, sitemap, data model and implementation sequence: `docs/ARCHITECTURE.md`.
- Engineering conventions (layering, server actions, UI tokens, honesty rules): `docs/CONVENTIONS.md`.
- Business logic lives in `src/server/**` and enforces its own authorization; pages and actions stay thin.
- Checks: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration` (uses the `youandme_test` database), `npm run test:e2e`.
