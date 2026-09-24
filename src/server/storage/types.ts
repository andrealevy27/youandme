export type StoredObject = { body: Uint8Array; contentType: string | null; size: number };

/**
 * Where uploaded bytes live. Implementations: local disk (dev) and S3-compatible (prod).
 * Keys are opaque, random and validated (`isValidStorageKey`) before reaching a driver.
 */
export interface StorageDriver {
  readonly name: "local" | "s3";
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  /** URL clients use to fetch the object (relative for local, absolute for S3). */
  publicUrl(key: string): string;
}
