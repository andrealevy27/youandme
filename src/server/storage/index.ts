import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { conversationMembers, fileUploads, messages } from "../db/schema";
import { AppError } from "../errors";
import { env, features } from "../env";
import { enforceRateLimit } from "../rate-limit";
import { createLocalDriver } from "./local";
import { createS3Driver } from "./s3";
import type { StorageDriver } from "./types";
import { isImageMime, isValidStorageKey, makeStorageKey, sanitizeFileName, validateUpload, type UploadPurpose } from "./validation";

export type { StorageDriver } from "./types";
export * from "./validation";

let driver: StorageDriver | null = null;

/** The configured storage driver. `STORAGE_DRIVER=s3` without credentials fails loudly instead of silently writing to disk. */
export function getStorage(): StorageDriver {
  if (driver) return driver;
  if (env.STORAGE_DRIVER === "s3") {
    if (!features.s3) throw new AppError("UNAVAILABLE", "File uploads aren't available right now (S3 not configured).");
    driver = createS3Driver({
      bucket: env.S3_BUCKET!,
      region: env.S3_REGION ?? "us-east-1",
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      endpoint: env.S3_ENDPOINT,
      publicUrl: env.S3_PUBLIC_URL,
    });
  } else {
    driver = createLocalDriver();
  }
  return driver;
}

/** Files readable by anyone with the link (profile photos, logos). Everything else goes through the access-checked /uploads route. */
const PUBLIC_PURPOSES: readonly UploadPurpose[] = ["avatar", "startup_logo", "portfolio"];

export type UploadResult = { url: string; name: string; size: number; mime: string };

/**
 * Validate, store and record an upload. Returns the contract used by the composer,
 * profile photo and other callers: `{ url, name, size, mime }`.
 */
export async function saveUpload(userId: string, file: File, purpose: UploadPurpose): Promise<UploadResult> {
  enforceRateLimit("upload", userId);
  const name = sanitizeFileName(file.name || "file");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateUpload({ mime: file.type, name, size: bytes.byteLength, purpose, head: bytes.subarray(0, 8192) });
  if (!check.ok) throw new AppError("VALIDATION", check.error);

  const storage = getStorage();
  const key = makeStorageKey(purpose, check.mime);
  await storage.put(key, bytes, check.mime);
  const url = storage.name === "s3" && env.S3_PUBLIC_URL && PUBLIC_PURPOSES.includes(purpose) ? storage.publicUrl(key) : `/uploads/${key}`;
  await db.insert(fileUploads).values({ userId, storageKey: key, url, mime: check.mime, size: bytes.byteLength, purpose });
  return { url, name, size: bytes.byteLength, mime: check.mime };
}

/**
 * Resolve an upload for serving. Message attachments are private to the uploader and the
 * members of a conversation the file was sent in; other purposes are link-readable
 * (keys are random UUIDs).
 */
export async function readUploadForViewer(key: string, viewerId: string | null) {
  if (!isValidStorageKey(key)) return null;
  const [row] = await db.select().from(fileUploads).where(eq(fileUploads.storageKey, key)).limit(1);
  if (!row) return null;
  if (row.purpose === "message" && row.userId !== viewerId) {
    if (!viewerId) return { denied: true as const };
    const [allowed] = await db
      .select({ id: messages.id })
      .from(messages)
      .innerJoin(conversationMembers, and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, viewerId)))
      .where(and(sql`${messages.attachments} @> ${JSON.stringify([{ url: row.url }])}::jsonb`, sql`${messages.deletedAt} is null`))
      .limit(1);
    if (!allowed) return { denied: true as const };
  }
  const object = await getStorage().get(key);
  if (!object) return null;
  return { denied: false as const, body: object.body, mime: row.mime, size: object.size, isImage: isImageMime(row.mime) };
}
