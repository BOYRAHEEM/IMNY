"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { TAGS } from "@/lib/cache-tags";
import { failure, type ActionResult } from "@/lib/errors";
import { SLUG_PATTERN, slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const categorySchema = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(1, "Enter a category name.").max(80),
  slug: z.string().trim().toLowerCase().max(100),
  description: text(2000),
  parent_id: z.uuid().nullable().or(z.literal("").transform(() => null)),
  sort_order: z.coerce.number().int().min(-1000).max(1000),
  is_active: z.boolean(),
  seo_title: text(120),
  seo_description: text(320),
});

export async function saveCategory(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch (err) {
    return failure("saveCategory.auth", err);
  }

  const parsed = categorySchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    description: formData.get("description") ?? "",
    parent_id: formData.get("parent_id") ?? "",
    sort_order: formData.get("sort_order") || 0,
    is_active: formData.get("is_active") === "on",
    seo_title: formData.get("seo_title") ?? "",
    seo_description: formData.get("seo_description") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };

  const { id, ...values } = parsed.data;
  values.slug = values.slug || slugify(values.name);
  if (!SLUG_PATTERN.test(values.slug)) {
    return { ok: false, error: "The web address can only use lowercase letters, numbers and dashes." };
  }
  if (id && values.parent_id === id) return { ok: false, error: "A category can't be inside itself." };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("categories").update(values).eq("id", id)
    : await supabase.from("categories").insert(values);
  if (error) return failure("saveCategory", error);

  updateTag(TAGS.catalog);
  redirect(`/admin/categories?saved=1`);
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    await requireStaff({ adminOnly: true });
  } catch (err) {
    return failure("deleteCategory.auth", err);
  }
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  // Products in this category become uncategorised (FK is ON DELETE SET NULL).
  const { error, count } = await supabase.from("categories").delete({ count: "exact" }).eq("id", id);
  if (error) return failure("deleteCategory", error);
  if (!count) return { ok: false, error: "You don't have permission to do that." };

  updateTag(TAGS.catalog);
  redirect("/admin/categories?deleted=1");
}
