"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { slugify } from "@/lib/slug";
import { deleteCategory, saveCategory } from "./actions";

export type CategoryFormValues = {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
};

export function CategoryForm({
  category,
  parents,
  canDelete,
  productCount,
}: {
  category: CategoryFormValues | null;
  parents: { id: string; name: string }[];
  canDelete: boolean;
  productCount: number;
}) {
  const [result, action] = useActionState(saveCategory, null);
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  return (
    <form action={action} className="space-y-4 p-4 sm:p-5">
      <FormMessage result={result ?? (deleteError ? { ok: false, error: deleteError } : null)} />
      {category?.id && <input type="hidden" name="id" value={category.id} />}

      <Field label="Name" htmlFor="cat-name">
        <Input
          id="cat-name"
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          required
          maxLength={80}
          placeholder="e.g. Dresses"
        />
      </Field>
      <Field label="Web address" htmlFor="cat-slug" hint={`/shop/${slug || "…"}`}>
        <Input
          id="cat-slug"
          name="slug"
          value={slug}
          onChange={(e) => {
            setSlug(slugify(e.target.value) || e.target.value.toLowerCase());
            setSlugTouched(true);
          }}
          maxLength={100}
        />
      </Field>
      <Field label="Description" htmlFor="cat-description" optional hint="Shown at the top of the category page.">
        <Textarea id="cat-description" name="description" defaultValue={category?.description ?? ""} maxLength={2000} rows={3} className="min-h-20" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Inside" htmlFor="cat-parent" optional>
          <Select id="cat-parent" name="parent_id" defaultValue={category?.parent_id ?? ""}>
            <option value="">Top level</option>
            {parents
              .filter((p) => p.id !== category?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Order" htmlFor="cat-order" hint="Lower numbers show first.">
          <Input id="cat-order" name="sort_order" type="number" inputMode="numeric" defaultValue={category?.sort_order ?? 0} min={-1000} max={1000} />
        </Field>
      </div>
      <Checkbox name="is_active" label="Show in the store" defaultChecked={category?.is_active ?? true} />

      <details className="group border-t border-line pt-4">
        <summary className="cursor-pointer text-sm font-medium">Search engine listing</summary>
        <div className="mt-4 space-y-4">
          <Field label="Page title" htmlFor="cat-seo-title" optional>
            <Input id="cat-seo-title" name="seo_title" defaultValue={category?.seo_title ?? ""} maxLength={120} />
          </Field>
          <Field label="Meta description" htmlFor="cat-seo-description" optional>
            <Textarea id="cat-seo-description" name="seo_description" defaultValue={category?.seo_description ?? ""} maxLength={320} rows={2} className="min-h-16" />
          </Field>
        </div>
      </details>

      <div className="flex flex-wrap gap-2 pt-2">
        <SubmitButton pendingText="Saving…">{category?.id ? "Save category" : "Add category"}</SubmitButton>
        <Link href="/admin/categories" className={buttonClasses("ghost")}>
          Cancel
        </Link>
      </div>

      {category?.id && canDelete && (
        <div className="border-t border-line pt-4">
          {confirming ? (
            <div className="space-y-2 border border-bad/25 bg-bad-bg p-3">
              <p className="text-sm text-bad">
                Delete this category?
                {productCount > 0 && ` Its ${productCount} product${productCount === 1 ? "" : "s"} will stay in the store without a category.`}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={deleting}
                  onClick={() =>
                    startDelete(async () => {
                      const r = await deleteCategory(category.id!);
                      if (r && !r.ok) {
                        setConfirming(false);
                        setDeleteError(r.error);
                      }
                    })
                  }
                >
                  Yes, delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
              Delete category
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
