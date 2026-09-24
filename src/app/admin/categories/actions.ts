"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/session";
import { runAction } from "@/server/errors";
import { createCategory, deleteCategory, setCategoryActive, updateCategory } from "@/server/admin/categories";
import { parseKeywords } from "@/server/admin/utils";

const id = z.string().trim().min(1).max(128);

const categoryInput = z.object({
  name: z.string().trim().min(2, "Give the category a name.").max(60),
  slug: z
    .string()
    .trim()
    .max(48)
    .regex(/^[a-z0-9-]*$/, "Slugs use lowercase letters, numbers and dashes.")
    .optional(),
  description: z.string().trim().max(300).optional(),
  keywords: z.string().max(2000).optional().transform((v) => parseKeywords(v)),
  sortOrder: z.coerce.number().int().min(-1000).max(10000).default(0),
  active: z.boolean().default(true),
});

function revalidate() {
  revalidatePath("/admin/categories");
}

export async function createCategoryAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("categories.manage");
    const data = categoryInput.parse(raw);
    await createCategory(viewer, data);
    revalidate();
  });
}

export async function updateCategoryAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("categories.manage");
    const data = categoryInput.extend({ id }).parse(raw);
    await updateCategory(viewer, data.id, data);
    revalidate();
  });
}

export async function setCategoryActiveAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("categories.manage");
    const data = z.object({ id, value: z.boolean() }).parse(raw);
    await setCategoryActive(viewer, { id: data.id, active: data.value });
    revalidate();
  });
}

export async function deleteCategoryAction(raw: unknown) {
  return runAction(async () => {
    const viewer = await requireAdmin("categories.manage");
    const data = z.object({ id }).parse(raw);
    await deleteCategory(viewer, data.id);
    revalidate();
  });
}
