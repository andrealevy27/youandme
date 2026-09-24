import { Tags } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/input";
import { AdminActionButton, AdminActionForm, AdminActionSwitch } from "@/components/admin/admin-action";
import { Muted } from "@/components/admin/data-table";
import { requireAdminPage } from "@/server/auth/session";
import { listCategories } from "@/server/admin/categories";
import { createCategoryAction, deleteCategoryAction, setCategoryActiveAction, updateCategoryAction } from "./actions";

export const metadata = { title: "Categories" };

type Category = Awaited<ReturnType<typeof listCategories>>[number];

function CategoryFields({ c, prefix }: { c?: Category; prefix: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" htmlFor={`${prefix}-name`}>
        <Input id={`${prefix}-name`} name="name" required minLength={2} maxLength={60} defaultValue={c?.name} placeholder="e.g. Paid social" />
      </Field>
      <Field label="Slug" htmlFor={`${prefix}-slug`} hint="Leave blank to generate from the name." optional>
        <Input id={`${prefix}-slug`} name="slug" maxLength={48} pattern="[a-z0-9-]*" defaultValue={c?.slug} placeholder="paid-social" />
      </Field>
      <Field label="Description" htmlFor={`${prefix}-description`} optional className="sm:col-span-2">
        <Textarea id={`${prefix}-description`} name="description" maxLength={300} defaultValue={c?.description ?? ""} className="min-h-16" />
      </Field>
      <Field label="Keywords" htmlFor={`${prefix}-keywords`} hint="Comma separated. Helps match what founders describe to this category." optional className="sm:col-span-2">
        <Input id={`${prefix}-keywords`} name="keywords" defaultValue={c?.keywords.join(", ")} placeholder="tiktok, meta ads, paid social" />
      </Field>
      <Field label="Sort order" htmlFor={`${prefix}-sort`} hint="Lower numbers show first.">
        <Input id={`${prefix}-sort`} name="sortOrder" type="number" min={-1000} max={10000} defaultValue={c?.sortOrder ?? 0} />
      </Field>
      <label className="flex items-center gap-2.5 self-end pb-3 text-[13.5px] font-medium">
        <input type="checkbox" name="active" defaultChecked={c?.active ?? true} className="size-4 accent-[var(--brand)]" />
        Active (visible to members)
      </label>
    </div>
  );
}

export default async function AdminCategoriesPage() {
  await requireAdminPage("categories.manage");
  const categories = await listCategories();

  return (
    <>
      <PageHeader title="Consultant categories" description="The expertise areas consultants list under and founders search by. Categories in use can be deactivated but not deleted." />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {categories.length === 0 ? (
            <EmptyState icon={<Tags />} title="No categories yet" description="Create the first category so consultants can describe what they do." />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-[16px] border border-border bg-card shadow-soft">
              {categories.map((c) => {
                const inUse = c.consultants + c.services > 0;
                return (
                  <li key={c.id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{c.name}</span>
                          <span className="font-mono text-[11.5px] text-subtle">{c.slug}</span>
                          {!c.active && <Badge variant="warning">Inactive</Badge>}
                        </p>
                        {c.description && <p className="mt-0.5 text-[13px] text-muted">{c.description}</p>}
                        <Muted>
                          #{c.sortOrder} · {c.consultants} consultants · {c.services} services
                          {c.keywords.length ? ` · ${c.keywords.length} keywords` : ""}
                        </Muted>
                      </div>
                      <AdminActionSwitch
                        action={setCategoryActiveAction}
                        payload={{ id: c.id }}
                        checked={c.active}
                        label={`${c.name} active`}
                        success={(on) => (on ? `${c.name} activated` : `${c.name} deactivated`)}
                      />
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[12.5px] font-medium text-brand-ink select-none">Edit</summary>
                      <div className="mt-3 rounded-[12px] bg-surface/60 p-4">
                        <AdminActionForm action={updateCategoryAction} payload={{ id: c.id }} submitLabel="Save category" success="Category saved">
                          <CategoryFields c={c} prefix={`edit-${c.id}`} />
                        </AdminActionForm>
                        <div className="mt-3 border-t border-border pt-3">
                          {inUse ? (
                            <p className="text-[12.5px] text-muted">In use — deactivate it instead of deleting.</p>
                          ) : (
                            <AdminActionButton
                              action={deleteCategoryAction}
                              payload={{ id: c.id }}
                              label="Delete category"
                              variant="ghost"
                              success="Category deleted"
                              confirm={{ title: `Delete ${c.name}?`, description: "Nobody uses this category, so it can be removed permanently.", confirmLabel: "Delete", destructive: true }}
                            />
                          )}
                        </div>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Card className="h-fit lg:col-span-2">
          <CardHeader>
            <CardTitle>New category</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminActionForm action={createCategoryAction} submitLabel="Create category" success="Category created" resetOnSuccess>
              <CategoryFields prefix="new" />
            </AdminActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
