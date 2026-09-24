import { createHash, createHmac } from "node:crypto";

/**
 * Minimal AWS Signature Version 4 (header auth) — enough for S3-compatible
 * PUT/GET/DELETE object calls without pulling in the AWS SDK.
 * Verified against the AWS SigV4 test suite ("get-vanilla") in tests/unit/storage.test.ts.
 */

export type SigV4Credentials = { accessKeyId: string; secretAccessKey: string; region: string; service: string };

export const sha256Hex = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

/** RFC 3986 encoding as AWS expects (unreserved chars untouched). */
export function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function amzDate(now: Date) {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

export function signV4(
  req: { method: string; url: URL; headers: Record<string, string>; payloadHash: string },
  creds: SigV4Credentials,
  now = new Date(),
): Record<string, string> {
  const stamp = amzDate(now);
  const day = stamp.slice(0, 8);
  const headers: Record<string, string> = { ...req.headers, host: req.url.host, "x-amz-date": stamp };
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v.trim().replace(/\s+/g, " ")]));
  const names = Object.keys(lower).sort();
  const canonicalHeaders = names.map((n) => `${n}:${lower[n]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalUri = req.url.pathname
    .split("/")
    .map((seg) => awsEncode(decodeURIComponent(seg)))
    .join("/") || "/";
  const canonicalQuery = [...req.url.searchParams.entries()]
    .map(([k, v]) => [awsEncode(k), awsEncode(v)] as const)
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const canonicalRequest = [req.method.toUpperCase(), canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, req.payloadHash].join("\n");
  const scope = `${day}/${creds.region}/${creds.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${creds.secretAccessKey}`, day);
  const kRegion = hmac(kDate, creds.region);
  const kService = hmac(kRegion, creds.service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
