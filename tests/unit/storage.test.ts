import { describe, expect, it } from "vitest";
import { amzDate, awsEncode, sha256Hex, signV4 } from "../../src/server/storage/sigv4";
import {
  isValidStorageKey,
  makeStorageKey,
  MAX_IMAGE_BYTES,
  normalizeMime,
  sanitizeFileName,
  sniffMatches,
  validateUpload,
} from "../../src/server/storage/validation";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PDF = new TextEncoder().encode("%PDF-1.7\n");
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

describe("upload validation", () => {
  it("accepts allowed types whose bytes match", () => {
    expect(validateUpload({ mime: "image/png", name: "a.png", size: 100, purpose: "message", head: PNG })).toEqual({ ok: true, mime: "image/png" });
    expect(validateUpload({ mime: "application/pdf", name: "deck.pdf", size: 100, purpose: "message", head: PDF }).ok).toBe(true);
    expect(
      validateUpload({
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        name: "memo.docx",
        size: 100,
        purpose: "document",
        head: ZIP,
      }).ok,
    ).toBe(true);
    expect(validateUpload({ mime: "image/webp", name: "a.webp", size: 10, purpose: "avatar", head: WEBP }).ok).toBe(true);
  });

  it("rejects disallowed types", () => {
    const r = validateUpload({ mime: "text/html", name: "x.html", size: 10, purpose: "message", head: new TextEncoder().encode("<html>") });
    expect(r.ok).toBe(false);
    expect(validateUpload({ mime: "image/svg+xml", name: "x.svg", size: 10, purpose: "message", head: new Uint8Array() }).ok).toBe(false);
  });

  it("rejects spoofed content (declared image, actually something else)", () => {
    expect(validateUpload({ mime: "image/png", name: "evil.png", size: 10, purpose: "message", head: PDF }).ok).toBe(false);
    expect(sniffMatches("image/jpeg", JPG)).toBe(true);
    expect(sniffMatches("image/jpeg", PNG)).toBe(false);
    expect(sniffMatches("text/plain", new Uint8Array([104, 105, 0, 1]))).toBe(false);
  });

  it("enforces per-kind size limits", () => {
    expect(validateUpload({ mime: "image/png", name: "a.png", size: MAX_IMAGE_BYTES + 1, purpose: "message", head: PNG }).ok).toBe(false);
    expect(validateUpload({ mime: "application/pdf", name: "a.pdf", size: 10 * 1024 * 1024, purpose: "message", head: PDF }).ok).toBe(true);
    expect(validateUpload({ mime: "application/pdf", name: "a.pdf", size: 16 * 1024 * 1024, purpose: "message", head: PDF }).ok).toBe(false);
    expect(validateUpload({ mime: "image/png", name: "a.png", size: 0, purpose: "message", head: PNG }).ok).toBe(false);
  });

  it("only allows images for avatars", () => {
    expect(validateUpload({ mime: "application/pdf", name: "a.pdf", size: 10, purpose: "avatar", head: PDF }).ok).toBe(false);
  });

  it("infers MIME from the extension when the browser sends a generic type", () => {
    expect(normalizeMime("", "photo.JPG")).toBe("image/jpeg");
    expect(normalizeMime("application/octet-stream", "notes.txt")).toBe("text/plain");
    expect(normalizeMime("image/jpg", "x")).toBe("image/jpeg");
  });

  it("generates random, well-formed storage keys and rejects traversal", () => {
    const key = makeStorageKey("message", "image/png", new Date("2026-03-04T00:00:00Z"));
    expect(key).toMatch(/^message\/2026\/03\/[0-9a-f-]{36}\.png$/);
    expect(isValidStorageKey(key)).toBe(true);
    expect(isValidStorageKey("../../etc/passwd")).toBe(false);
    expect(isValidStorageKey("message/2026/03/../../x.png")).toBe(false);
    expect(makeStorageKey("message", "image/png")).not.toBe(makeStorageKey("message", "image/png"));
  });

  it("sanitises file names", () => {
    expect(sanitizeFileName("C:\\Users\\me\\deck.pdf")).toBe("deck.pdf");
    expect(sanitizeFileName('../"evil"<x>.txt')).toBe("evilx.txt");
    expect(sanitizeFileName("")).toBe("file");
  });
});

describe("SigV4", () => {
  it("matches the AWS test suite 'get-vanilla' vector", () => {
    const headers = signV4(
      { method: "GET", url: new URL("https://example.amazonaws.com/"), headers: {}, payloadHash: sha256Hex("") },
      { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", region: "us-east-1", service: "service" },
      new Date("2015-08-30T12:36:00Z"),
    );
    expect(headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
    );
  });

  it("formats dates and encodes like AWS", () => {
    expect(amzDate(new Date("2015-08-30T12:36:00.123Z"))).toBe("20150830T123600Z");
    expect(awsEncode("a b*(c)!")).toBe("a%20b%2A%28c%29%21");
  });
});
