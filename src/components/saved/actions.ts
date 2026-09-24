"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/server/auth/session";
import { runAction, type ActionResult } from "@/server/errors";
import {
  createCollection,
  deleteCollection,
  moveSavedItem,
  removeSavedItem,
  renameCollection,
  saveTargetSchema,
  toggleSaved,
} from "@/server/saved";
import type { SaveTarget } from "@/lib/domain";

const id = z.string().min(1).max(100);

/** Used by `<SaveButton>`. Returns the new saved state. */
export async function toggleSavedAction(targetType: SaveTarget, targetId: string, collectionId?: string): Promise<ActionResult<{ saved: boolean }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const res = await toggleSaved(viewer.userId, saveTargetSchema.parse(targetType), id.parse(targetId), collectionId ? id.parse(collectionId) : undefined);
    revalidatePath("/saved");
    return { saved: res.saved };
  });
}

export async function removeSavedItemAction(itemId: string): Promise<ActionResult> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await removeSavedItem(viewer.userId, id.parse(itemId));
    revalidatePath("/saved");
  });
}

export async function moveSavedItemAction(itemId: string, collectionId: string): Promise<ActionResult> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await moveSavedItem(viewer.userId, id.parse(itemId), id.parse(collectionId));
    revalidatePath("/saved");
  });
}

export async function createCollectionAction(name: string): Promise<ActionResult<{ id: string; name: string }>> {
  return runAction(async () => {
    const viewer = await requireViewer();
    const c = await createCollection(viewer.userId, name);
    revalidatePath("/saved");
    return { id: c.id, name: c.name };
  });
}

export async function renameCollectionAction(collectionId: string, name: string): Promise<ActionResult> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await renameCollection(viewer.userId, id.parse(collectionId), name);
    revalidatePath("/saved");
  });
}

export async function deleteCollectionAction(collectionId: string): Promise<ActionResult> {
  return runAction(async () => {
    const viewer = await requireViewer();
    await deleteCollection(viewer.userId, id.parse(collectionId));
    revalidatePath("/saved");
  });
}
