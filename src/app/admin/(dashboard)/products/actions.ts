"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { TAGS } from "@/lib/cache-tags";
import { failure, logError, type ActionResult } from "@/lib/errors";
import { CATALOG_BUCKET } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";
import { productPayloadSchema } from "@/lib/validation/product";

function expireProductCaches(...slugs: Array<string | null | undefined>) {
  updateTag(TAGS.catalog);
  for (const slug of new Set(slugs.filter(Boolean) as string[])) updateTag(TAGS.product(slug));
}

export async function saveProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireStaff();
  } catch (err) {
    return failure("saveProduct.auth", err);
  }

  const parsed = productPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Some details are invalid." };
  }
  const p = parsed.data;
  const supabase = await createClient();

  // What exists now, so we can clean up removed images and expire the old URL.
  const [{ data: existing }, { data: oldImages }] = await Promise.all([
    supabase.from("products").select("slug").eq("id", p.id).maybeSingle(),
    supabase.from("product_images").select("storage_path").eq("product_id", p.id),
  ]);

  const { error } = await supabase.rpc("admin_save_product", { p });
  if (error) return failure("saveProduct.rpc", error);

  const keep = new Set(p.images.map((i) => i.storage_path));
  const removed = (oldImages ?? []).map((i) => i.storage_path).filter((path) => !keep.has(path));
  if (removed.length) {
    const { error: rmError } = await supabase.storage.from(CATALOG_BUCKET).remove(removed);
    if (rmError) logError("saveProduct.removeImages", rmError); // product is saved; orphaned files are harmless
  }

  expireProductCaches(p.slug, existing?.slug);
  return { ok: true, data: { id: p.id }, message: p.status === "active" ? "Product saved and published." : "Product saved." };
}

const statusSchema = z.object({ id: z.uuid(), status: z.enum(["draft", "active", "archived"]) });

export async function setProductStatus(id: string, status: string): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch (err) {
    return failure("setProductStatus.auth", err);
  }
  const parsed = statusSchema.safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  if (parsed.data.status === "active") {
    const { count } = await supabase
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id)
      .eq("is_active", true);
    if (!count) return { ok: false, error: "Add at least one active variant with a price before publishing." };
  }

  const { data, error } = await supabase
    .from("products")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .select("slug")
    .single();
  if (error) return failure("setProductStatus", error);

  expireProductCaches(data.slug);
  return { ok: true, data: undefined };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    await requireStaff({ adminOnly: true });
  } catch (err) {
    return failure("deleteProduct.auth", err);
  }
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const [{ data: product }, { data: images }] = await Promise.all([
    supabase.from("products").select("slug").eq("id", id).maybeSingle(),
    supabase.from("product_images").select("storage_path").eq("product_id", id),
  ]);
  if (!product) return { ok: false, error: "That product no longer exists." };

  const { error, count } = await supabase.from("products").delete({ count: "exact" }).eq("id", id);
  if (error) return failure("deleteProduct", error);
  if (!count) return { ok: false, error: "You don't have permission to do that." };

  // Remove every file under the product's folder, including unsaved uploads.
  const { data: files } = await supabase.storage.from(CATALOG_BUCKET).list(`products/${id}`, { limit: 1000 });
  const paths = new Set([
    ...(images ?? []).map((i) => i.storage_path),
    ...(files ?? []).map((f) => `products/${id}/${f.name}`),
  ]);
  if (paths.size) {
    const { error: rmError } = await supabase.storage.from(CATALOG_BUCKET).remove([...paths]);
    if (rmError) logError("deleteProduct.removeImages", rmError);
  }

  expireProductCaches(product.slug);
  redirect("/admin/products?deleted=1");
}
