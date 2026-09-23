import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { logError } from "@/lib/errors";
import { createPublicClient } from "@/lib/supabase/server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = publicEnv.NEXT_PUBLIC_SITE_URL;
  const db = createPublicClient();
  const [products, categories] = await Promise.all([
    db.from("products").select("slug, updated_at").order("updated_at", { ascending: false }).limit(5000),
    db.from("categories").select("slug, updated_at"),
  ]);
  if (products.error) logError("sitemap.products", products.error);
  if (categories.error) logError("sitemap.categories", categories.error);

  return [
    { url: site, changeFrequency: "daily", priority: 1 },
    { url: `${site}/shop`, changeFrequency: "daily", priority: 0.9 },
    ...(categories.data ?? []).map((c) => ({
      url: `${site}/shop/${c.slug}`,
      lastModified: c.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...(products.data ?? []).map((p) => ({
      url: `${site}/product/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
