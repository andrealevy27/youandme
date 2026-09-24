import { AppError } from "./errors";

/**
 * Fixed-window rate limiter. In-memory per instance — adequate for a single node
 * and for dev; swap `store` for Redis/Upstash when running multiple instances.
 */
type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

export type RateLimitRule = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  message: { limit: 30, windowMs: 60_000 },
  ai: { limit: 20, windowMs: 60_000 },
  search: { limit: 60, windowMs: 60_000 },
  interest: { limit: 60, windowMs: 60_000 },
  connection: { limit: 30, windowMs: 60 * 60_000 },
  report: { limit: 10, windowMs: 60 * 60_000 },
  booking: { limit: 10, windowMs: 60 * 60_000 },
  upload: { limit: 20, windowMs: 60 * 60_000 },
  invite: { limit: 30, windowMs: 60 * 60_000 },
  waitlist: { limit: 5, windowMs: 60 * 60_000 },
} satisfies Record<string, RateLimitRule>;

export function checkRateLimit(key: string, rule: RateLimitRule, now = Date.now()) {
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, remaining: rule.limit - 1 };
  }
  bucket.count += 1;
  return { allowed: bucket.count <= rule.limit, remaining: Math.max(0, rule.limit - bucket.count) };
}

export function enforceRateLimit(scope: keyof typeof RATE_LIMITS, subject: string) {
  const { allowed } = checkRateLimit(`${scope}:${subject}`, RATE_LIMITS[scope]);
  if (!allowed) throw new AppError("RATE_LIMITED", "You're going a little fast. Please wait a moment and try again.");
}

export function resetRateLimits() {
  store.clear();
}
