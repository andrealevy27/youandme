import { z } from "zod";

/**
 * Server environment. Optional integrations are `undefined` when unset;
 * `features` exposes what's actually available so the UI can hide or label
 * missing integrations instead of faking them.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgres://youandme:youandme@localhost:5432/youandme"),
  BETTER_AUTH_SECRET: z.string().min(16).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  TRUSTED_ORIGINS: z.string().default(""),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  AI_PROVIDER: z.enum(["anthropic", "none"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-opus-5"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYMENTS_PROVIDER: z.enum(["stripe", "dev"]).default("stripe"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("You&Me <hello@youandme.company>"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  POSTHOG_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().optional(),
  ADMIN_EMAILS: z.string().default(""),
});

const blankToUndefined = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
);

export const env = schema.parse(blankToUndefined);

const has = (...vals: (string | undefined)[]) => vals.every((v) => typeof v === "string" && v.length > 0);

export const features = {
  google: has(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
  apple: has(env.APPLE_CLIENT_ID, env.APPLE_CLIENT_SECRET),
  linkedin: has(env.LINKEDIN_CLIENT_ID, env.LINKEDIN_CLIENT_SECRET),
  ai: env.AI_PROVIDER === "anthropic" && has(env.ANTHROPIC_API_KEY),
  stripe: has(env.STRIPE_SECRET_KEY),
  /** Dev payments are refused in production regardless of configuration. */
  devPayments: env.PAYMENTS_PROVIDER === "dev" && env.NODE_ENV !== "production",
  email: has(env.RESEND_API_KEY),
  s3: env.STORAGE_DRIVER === "s3" && has(env.S3_BUCKET, env.S3_ACCESS_KEY_ID, env.S3_SECRET_ACCESS_KEY),
};

export const adminBootstrapEmails = env.ADMIN_EMAILS.split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
