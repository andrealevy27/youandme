import "server-only";
import { AppError } from "../errors";

/** Admins never moderate their own account from the panel — it prevents accidental lock-outs. */
export function assertNotSelf(actorId: string, targetId: string, what = "this action") {
  if (actorId === targetId) throw new AppError("FORBIDDEN", `You can't apply ${what} to your own account.`);
}
