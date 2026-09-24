import { AppError } from "../errors";
import type { StorageDriver } from "./types";
import { sha256Hex, signV4 } from "./sigv4";

export type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Custom endpoint for S3-compatible providers (R2, MinIO, Spaces…). Uses path-style addressing. */
  endpoint?: string;
  /** Public base URL (CDN or bucket website). Falls back to the object URL. */
  publicUrl?: string;
};

/** S3-compatible driver using fetch + SigV4 (no SDK). Objects are written private-by-default; serve via `publicUrl`. */
export function createS3Driver(cfg: S3Config): StorageDriver {
  const objectUrl = (key: string) => {
    const encoded = key.split("/").map(encodeURIComponent).join("/");
    if (cfg.endpoint) return new URL(`${cfg.endpoint.replace(/\/$/, "")}/${cfg.bucket}/${encoded}`);
    return new URL(`https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${encoded}`);
  };
  const creds = { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: cfg.region, service: "s3" };

  async function send(method: "PUT" | "GET" | "DELETE", key: string, body?: Uint8Array, contentType?: string) {
    const url = objectUrl(key);
    const payloadHash = body ? sha256Hex(body) : sha256Hex("");
    const base: Record<string, string> = { "x-amz-content-sha256": payloadHash };
    if (contentType) base["content-type"] = contentType;
    const headers = signV4({ method, url, headers: base, payloadHash }, creds);
    delete headers.host; // fetch sets Host itself
    return fetch(url, { method, headers, body: body ? new Blob([body as BlobPart]) : undefined, cache: "no-store" });
  }

  return {
    name: "s3",
    async put(key, body, contentType) {
      const res = await send("PUT", key, body, contentType);
      if (!res.ok) throw new AppError("UNAVAILABLE", "We couldn't store that file right now. Please try again.");
    },
    async get(key) {
      const res = await send("GET", key);
      if (res.status === 404) return null;
      if (!res.ok) throw new AppError("UNAVAILABLE", "That file is temporarily unavailable.");
      const body = new Uint8Array(await res.arrayBuffer());
      return { body, contentType: res.headers.get("content-type"), size: body.byteLength };
    },
    async delete(key) {
      const res = await send("DELETE", key);
      if (!res.ok && res.status !== 404) throw new AppError("UNAVAILABLE", "We couldn't delete that file right now.");
    },
    publicUrl(key) {
      if (cfg.publicUrl) return `${cfg.publicUrl.replace(/\/$/, "")}/${key}`;
      return objectUrl(key).toString();
    },
  };
}
