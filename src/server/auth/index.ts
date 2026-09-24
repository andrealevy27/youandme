import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import { emailLayout, sendEmail } from "../email";
import { env, features } from "../env";
import { onUserCreated, assertSignupAllowed, INVITE_COOKIE } from "./lifecycle";

const socialProviders = {
  ...(features.google && { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! } }),
  ...(features.apple && { apple: { clientId: env.APPLE_CLIENT_ID!, clientSecret: env.APPLE_CLIENT_SECRET! } }),
  ...(features.linkedin && { linkedin: { clientId: env.LINKEDIN_CLIENT_ID!, clientSecret: env.LINKEDIN_CLIENT_SECRET! } }),
};

function readCookie(headers: Headers | undefined, name: string) {
  const raw = headers?.get("cookie");
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export const auth = betterAuth({
  appName: "You&Me",
  baseURL: env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    async sendResetPassword({ user, url }) {
      await sendEmail({
        to: user.email,
        subject: "Reset your You&Me password",
        text: `Reset your password: ${url}`,
        html: emailLayout("Reset your password", "Use the button below to choose a new password. The link expires in one hour.", {
          label: "Reset password",
          url,
        }),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await sendEmail({
        to: user.email,
        subject: "Confirm your email for You&Me",
        text: `Confirm your email: ${url}`,
        html: emailLayout("Confirm your email", "One click and you're verified.", { label: "Confirm email", url }),
      });
    },
  },
  socialProviders,
  account: { accountLinking: { enabled: true, trustedProviders: ["google", "apple", "linkedin"] } },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: env.NODE_ENV !== "test",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
    },
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    database: { generateId: () => crypto.randomUUID() },
  },
  databaseHooks: {
    user: {
      create: {
        async before(_user, ctx) {
          await assertSignupAllowed(readCookie(ctx?.request?.headers ?? ctx?.headers, INVITE_COOKIE));
        },
        async after(user, ctx) {
          await onUserCreated(user, readCookie(ctx?.request?.headers ?? ctx?.headers, INVITE_COOKIE));
        },
      },
    },
    session: {
      create: {
        // Server-side enforcement: suspended / banned / deleted accounts cannot start sessions.
        async before(session) {
          const [profile] = await db
            .select({ status: schema.profiles.status, suspendedUntil: schema.profiles.suspendedUntil })
            .from(schema.profiles)
            .where(eq(schema.profiles.userId, session.userId))
            .limit(1);
          if (!profile) return;
          if (profile.status === "banned" || profile.status === "deleted") {
            throw new APIError("FORBIDDEN", { message: "This account is no longer active." });
          }
          if (profile.status === "suspended" && (!profile.suspendedUntil || profile.suspendedUntil > new Date())) {
            throw new APIError("FORBIDDEN", { message: "This account is temporarily suspended." });
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
