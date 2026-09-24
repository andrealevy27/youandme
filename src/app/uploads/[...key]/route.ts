import { getViewerFromHeaders } from "@/server/auth/session";
import { logger } from "@/server/logger";
import { readUploadForViewer } from "@/server/storage";

/**
 * Serves stored uploads. Only keys recorded in `file_uploads` are served (never arbitrary
 * paths); message attachments additionally require conversation membership.
 */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const storageKey = key.join("/");
  try {
    const viewer = await getViewerFromHeaders(req.headers);
    const file = await readUploadForViewer(storageKey, viewer?.userId ?? null);
    if (!file) return new Response("Not found", { status: 404, headers: { "x-content-type-options": "nosniff" } });
    if (file.denied) return new Response("Forbidden", { status: 403, headers: { "x-content-type-options": "nosniff" } });
    const url = new URL(req.url);
    const filename = url.searchParams.get("name")?.replace(/[^\w.\- ]/g, "_").slice(0, 120) || storageKey.split("/").pop()!;
    const headers = new Headers({
      "content-type": file.mime,
      "content-length": String(file.size),
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=31536000, immutable",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "content-disposition": file.isImage ? "inline" : `attachment; filename="${filename}"`,
    });
    return new Response(file.body as BodyInit, { status: 200, headers });
  } catch (err) {
    logger.error("upload_serve_failed", { err, key: storageKey });
    return new Response("Unavailable", { status: 503 });
  }
}
