import "server-only";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { logError } from "@/lib/errors";
import { createPublicClient } from "@/lib/supabase/server";

/**
 * Storefront reads. All use the anon key (RLS limits them to published
 * data), are cached, and are expired by admin actions via cache tags.
 * Failures throw inside the cache so an error is never cached.
 */

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  price_min: number;
  price_max: number;
  compare_at_min: number | null;
  image_path: string | null;
  image_alt: string | null;
  hover_image_path: string | null;
  available: number;
  swatches: { value: string; hex: string }[];
};

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  category: { id: string; name: string; slug: string } | null;
  options: { id: string; name: string; position: number; values: { id: string; value: string; swatch_hex: string | null; position: number }[] }[];
  variants: {
    id: string;
    sku: string | null;
    price_minor: number;
    compare_at_price_minor: number | null;
    option1_value_id: string | null;
    option2_value_id: string | null;
    option3_value_id: string | null;
    position: number;
  }[];
  images: { id: string; storage_path: string; alt_text: string | null; width: number | null; height: number | null; position: number; is_primary: boolean; option_value_id: string | null }[];
  updated_at: string;
};

export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const { data, error } = await createPublicClient()
      .from("categories")
      .select("id, name, slug, description, parent_id, seo_title, seo_description")
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return data;
  },
  ["categories"],
  { tags: [TAGS.catalog], revalidate: 3600 },
);

type ListArgs = {
  categoryId?: string;
  sort?: "newest" | "price_asc" | "price_desc";
  featured?: boolean;
  search?: string;
  exclude?: string;
  limit?: number;
  offset?: number;
};

export const listProducts = unstable_cache(
  async (args: ListArgs): Promise<{ products: ProductCard[]; total: number }> => {
    const { data, error } = await createPublicClient().rpc("storefront_products", {
      p_category_id: args.categoryId,
      p_sort: args.sort ?? "newest",
      p_featured: args.featured,
      p_search: args.search,
      p_exclude: args.exclude,
      p_limit: args.limit ?? 24,
      p_offset: args.offset ?? 0,
    });
    if (error) throw error;
    return {
      products: (data ?? []).map((p) => ({
        ...p,
        available: Number(p.available),
        swatches: (p.swatches ?? []) as ProductCard["swatches"],
      })),
      total: Number(data?.[0]?.total_count ?? 0),
    };
  },
  ["storefront-products"],
  // Stock changes with every sale, so this also carries the stock tag.
  { tags: [TAGS.catalog, TAGS.stock], revalidate: 300 },
);

export const getProductBySlug = (slug: string) =>
  unstable_cache(
    async (): Promise<ProductDetail | null> => {
      const { data, error } = await createPublicClient()
        .from("products")
        .select(
          "id, slug, name, description, seo_title, seo_description, updated_at, " +
            "category:categories(id, name, slug), " +
            "options:product_options(id, name, position, values:product_option_values(id, value, swatch_hex, position)), " +
            "variants:product_variants(id, sku, price_minor, compare_at_price_minor, option1_value_id, option2_value_id, option3_value_id, position), " +
            "images:product_images(id, storage_path, alt_text, width, height, position, is_primary, option_value_id)",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const p = data as unknown as ProductDetail;
      p.options.sort((a, b) => a.position - b.position).forEach((o) => o.values.sort((a, b) => a.position - b.position));
      p.variants.sort((a, b) => a.position - b.position);
      p.images.sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position);
      return p;
    },
    ["product", slug],
    { tags: [TAGS.catalog, TAGS.product(slug)], revalidate: 3600 },
  )();

/** Units available per active variant. Short-lived: stock moves with every order. */
export const getAvailability = unstable_cache(
  async (productIds: string[]): Promise<Record<string, number>> => {
    if (productIds.length === 0) return {};
    const { data, error } = await createPublicClient().rpc("variant_availability", { p_product_ids: productIds });
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((r) => [r.variant_id, r.available]));
  },
  ["availability"],
  { tags: [TAGS.stock], revalidate: 60 },
);

/** Swallow errors for non-critical sections so one failure doesn't break a page. */
export async function safely<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logError(label, err);
    return fallback;
  }
}
