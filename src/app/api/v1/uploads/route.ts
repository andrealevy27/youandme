import { z } from "zod";
import { AppError } from "@/server/errors";
import { apiRoute } from "@/server/messaging/http";
import { saveUpload, UPLOAD_PURPOSES } from "@/server/storage";

const purposeSchema = z.enum(UPLOAD_PURPOSES).default("message");

/**
 * POST multipart/form-data: `file` (required), `purpose` (message | avatar | startup_logo | portfolio | document).
 * → 200 `{ url, name, size, mime }` · 400 validation · 401 · 429 rate limited.
 */
export const POST = apiRoute(async ({ req, viewer }) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new AppError("VALIDATION", "Send the file as multipart/form-data.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION", "Choose a file to upload.");
  const purpose = purposeSchema.parse(form.get("purpose") ?? undefined);
  return saveUpload(viewer.userId, file, purpose);
});
