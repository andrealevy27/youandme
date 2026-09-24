import { createHash } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { identityVerifications } from "../db/schema";
import { AppError } from "../errors";
import { emailLayout, sendEmail } from "../email";
import { env } from "../env";
import { enforceRateLimit } from "../rate-limit";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Academic domains we accept: *.edu, *.ac.xx, *.edu.xx. Deliberately conservative. */
export function isAcademicDomain(domain: string) {
  const d = domain.toLowerCase();
  return /\.edu$/.test(d) || /\.ac\.[a-z]{2}$/.test(d) || /\.edu\.[a-z]{2}$/.test(d);
}

export async function requestUniversityVerification(userId: string, rawEmail: string) {
  const email = z.string().trim().toLowerCase().email("Enter a valid email.").parse(rawEmail);
  const domain = email.split("@")[1]!;
  if (!isAcademicDomain(domain)) throw new AppError("VALIDATION", "Use your university email (for example, name@school.edu).");
  enforceRateLimit("invite", `univ:${userId}`);
  const token = crypto.randomUUID().replace(/-/g, "");
  await db.insert(identityVerifications).values({
    userId,
    type: "university_email",
    status: "pending",
    subject: domain,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + 24 * 3_600_000),
  });
  const url = `${env.NEXT_PUBLIC_APP_URL}/verify/university?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Confirm your university email on You&Me",
    text: `Confirm your university email: ${url}`,
    html: emailLayout("Confirm your university email", `Click below to confirm you have access to an address at ${domain}. The link expires in 24 hours.`, { label: "Confirm email", url }),
  });
  return { domain };
}

export async function confirmUniversityVerification(userId: string, token: string) {
  const [row] = await db
    .select()
    .from(identityVerifications)
    .where(
      and(
        eq(identityVerifications.userId, userId),
        eq(identityVerifications.type, "university_email"),
        eq(identityVerifications.tokenHash, hash(token)),
        eq(identityVerifications.status, "pending"),
        gt(identityVerifications.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "This link is invalid or has expired. Request a new one from Settings.");
  await db.update(identityVerifications).set({ status: "verified", verifiedAt: new Date(), tokenHash: null }).where(eq(identityVerifications.id, row.id));
  return { domain: row.subject };
}

export async function listMyVerifications(userId: string) {
  return db
    .select({ type: identityVerifications.type, status: identityVerifications.status, subject: identityVerifications.subject, verifiedAt: identityVerifications.verifiedAt })
    .from(identityVerifications)
    .where(eq(identityVerifications.userId, userId))
    .orderBy(desc(identityVerifications.createdAt));
}
