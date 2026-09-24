import "server-only";
import { asc, eq, ne, and, sql } from "drizzle-orm";
import { db } from "../db";
import { consultantCategories, consultantProfileCategories, consultantServices, needs } from "../db/schema";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import type { Viewer } from "../auth/session";
import { slugify } from "@/lib/slug";

export type CategoryInput = {
  name: string;
  slug?: string;
  description?: string;
  keywords: string[];
  sortOrder: number;
  active: boolean;
};

export async function listCategories() {
  return db
    .select({
      id: consultantCategories.id,
      name: consultantCategories.name,
      slug: consultantCategories.slug,
      description: consultantCategories.description,
      keywords: consultantCategories.keywords,
      sortOrder: consultantCategories.sortOrder,
      active: consultantCategories.active,
      consultants: sql<number>`(select count(*)::int from ${consultantProfileCategories} where ${consultantProfileCategories.categoryId} = ${consultantCategories.id})`,
      services: sql<number>`(select count(*)::int from ${consultantServices} where ${consultantServices.categoryId} = ${consultantCategories.id} and ${consultantServices.deletedAt} is null)`,
    })
    .from(consultantCategories)
    .orderBy(asc(consultantCategories.sortOrder), asc(consultantCategories.name));
}

async function assertSlugFree(slug: string, exceptId?: string) {
  const [taken] = await db
    .select({ id: consultantCategories.id })
    .from(consultantCategories)
    .where(and(eq(consultantCategories.slug, slug), exceptId ? ne(consultantCategories.id, exceptId) : undefined))
    .limit(1);
  if (taken) throw new AppError("CONFLICT", `The slug "${slug}" is already used by another category.`);
}

function cleanSlug(input: CategoryInput) {
  const slug = slugify(input.slug || input.name, 48);
  if (!slug) throw new AppError("VALIDATION", "Give the category a name or slug with letters or numbers.");
  return slug;
}

export async function createCategory(actor: Viewer, input: CategoryInput) {
  const slug = cleanSlug(input);
  await assertSlugFree(slug);
  const [row] = await db
    .insert(consultantCategories)
    .values({ name: input.name, slug, description: input.description || null, keywords: input.keywords, sortOrder: input.sortOrder, active: input.active })
    .returning({ id: consultantCategories.id });
  await audit({ actorId: actor.userId, action: "category.created", targetType: "consultant_category", targetId: row!.id, metadata: { name: input.name, slug } });
  return row!;
}

export async function updateCategory(actor: Viewer, id: string, input: CategoryInput) {
  const [before] = await db.select().from(consultantCategories).where(eq(consultantCategories.id, id)).limit(1);
  if (!before) throw notFound("That category");
  const slug = cleanSlug(input);
  await assertSlugFree(slug, id);
  await db
    .update(consultantCategories)
    .set({ name: input.name, slug, description: input.description || null, keywords: input.keywords, sortOrder: input.sortOrder, active: input.active })
    .where(eq(consultantCategories.id, id));
  await audit({
    actorId: actor.userId,
    action: "category.updated",
    targetType: "consultant_category",
    targetId: id,
    metadata: { before: { name: before.name, slug: before.slug, active: before.active, sortOrder: before.sortOrder }, after: { name: input.name, slug, active: input.active, sortOrder: input.sortOrder } },
  });
}

export async function setCategoryActive(actor: Viewer, input: { id: string; active: boolean }) {
  const res = await db.update(consultantCategories).set({ active: input.active }).where(eq(consultantCategories.id, input.id)).returning({ id: consultantCategories.id });
  if (!res.length) throw notFound("That category");
  await audit({ actorId: actor.userId, action: input.active ? "category.activated" : "category.deactivated", targetType: "consultant_category", targetId: input.id });
}

/** Hard delete only when nothing references the category; otherwise it must be deactivated. */
export async function deleteCategory(actor: Viewer, id: string) {
  const [cat] = await db.select().from(consultantCategories).where(eq(consultantCategories.id, id)).limit(1);
  if (!cat) throw notFound("That category");
  const [usage] = await db.execute<{ n: number }>(sql`
    select
      (select count(*) from ${consultantProfileCategories} where ${consultantProfileCategories.categoryId} = ${id})
      + (select count(*) from ${consultantServices} where ${consultantServices.categoryId} = ${id})
      + (select count(*) from ${needs} where ${needs.consultantCategoryId} = ${id}) as n
  `);
  if (Number(usage?.n ?? 0) > 0) {
    throw new AppError("CONFLICT", "This category is in use by consultants, services or needs. Deactivate it instead.");
  }
  await db.delete(consultantCategories).where(eq(consultantCategories.id, id));
  await audit({ actorId: actor.userId, action: "category.deleted", targetType: "consultant_category", targetId: id, metadata: { name: cat.name, slug: cat.slug } });
}
