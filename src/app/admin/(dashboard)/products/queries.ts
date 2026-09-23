import "server-only";
import { logError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { DbProduct } from "@/components/admin/product-editor/model";

export async function getCategoryOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("id, name").order("sort_order").order("name");
  if (error) logError("getCategoryOptions", error);
  return data ?? [];
}

/** Full product for the editor (staff can read drafts via RLS). */
export async function getProductForEditor(id: string): Promise<(DbProduct & { updated_at: string }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, description, category_id, status, featured, seo_title, seo_description, updated_at, " +
        "options:product_options(id, name, position, values:product_option_values(id, value, swatch_hex, position)), " +
        "variants:product_variants(id, sku, price_minor, compare_at_price_minor, option1_value_id, option2_value_id, option3_value_id, is_active, position, inventory(on_hand, reserved)), " +
        "images:product_images(id, storage_path, alt_text, option_value_id, width, height, position, is_primary)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    logError("getProductForEditor", error);
    return null;
  }
  return data as unknown as (DbProduct & { updated_at: string }) | null;
}
