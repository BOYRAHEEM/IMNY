import Link from "next/link";
import { Icon } from "@/components/admin/icons";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireStaffPage } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { logError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { CategoryForm } from "./category-form";

export const metadata = { title: "Categories" };

export default async function CategoriesPage({ searchParams }: PageProps<"/admin/categories">) {
  const user = await requireStaffPage();
  const sp = await searchParams;
  const editId = typeof sp.edit === "string" ? sp.edit : null;
  const creating = sp.new === "1";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, parent_id, sort_order, is_active, seo_title, seo_description, products(count)")
    .order("sort_order")
    .order("name");
  if (error) logError("categories.list", error);

  const categories = (data ?? []).map((c) => ({
    ...c,
    productCount: (c.products as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
  const byId = new Map(categories.map((c) => [c.id, c]));
  const editing = editId ? byId.get(editId) ?? null : null;
  const showForm = creating || editing;

  // Parents first, children indented beneath them.
  const top = categories.filter((c) => !c.parent_id || !byId.has(c.parent_id));
  const ordered = top.flatMap((p) => [p, ...categories.filter((c) => c.parent_id === p.id)]);

  return (
    <>
      <PageHeader
        title="Categories"
        description="Group products into collections customers can browse, like Dresses or New In."
        actions={
          !showForm && (
            <ButtonLink href="/admin/categories?new=1">
              <Icon name="plus" className="size-4" /> Add category
            </ButtonLink>
          )
        }
      />

      {(sp.saved === "1" || sp.deleted === "1") && (
        <p role="status" className="mb-4 border border-good/25 bg-good-bg px-4 py-3 text-sm text-good">
          {sp.saved === "1" ? "Category saved." : "Category deleted."}
        </p>
      )}

      <div className={cn("grid gap-6", showForm && "lg:grid-cols-[1fr_400px]")}>
        {showForm && (
          <div className="lg:order-2">
            <Panel title={editing ? `Edit ${editing.name}` : "New category"}>
              <CategoryForm
                key={editing?.id ?? "new"}
                category={editing}
                parents={top.map(({ id, name }) => ({ id, name }))}
                canDelete={user.role === "admin"}
                productCount={editing?.productCount ?? 0}
              />
            </Panel>
          </div>
        )}

        <div className="lg:order-1">
          {ordered.length === 0 ? (
            !showForm && (
              <EmptyState
                title="No categories yet."
                description="Categories appear in your shop's navigation."
                action={<ButtonLink href="/admin/categories?new=1">Add your first category</ButtonLink>}
              />
            )
          ) : (
            <ul className="divide-y divide-line border border-line bg-paper">
              {ordered.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/categories?edit=${c.id}`}
                    aria-current={editing?.id === c.id ? "true" : undefined}
                    className={cn("flex items-center gap-3 px-4 py-3 hover:bg-mist", editing?.id === c.id && "bg-mist")}
                  >
                    <div className={cn("min-w-0 flex-1", c.parent_id && byId.has(c.parent_id) && "pl-5")}>
                      <p className="truncate text-sm font-medium">
                        {c.parent_id && byId.has(c.parent_id) && <span className="text-faint">↳ </span>}
                        {c.name}
                      </p>
                      <p className="truncate text-xs text-muted">/shop/{c.slug}</p>
                    </div>
                    <span className="text-sm text-muted tabular">
                      {c.productCount} product{c.productCount === 1 ? "" : "s"}
                    </span>
                    {!c.is_active && <Badge>Hidden</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
