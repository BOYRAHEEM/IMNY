import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findCategory, isSortKey, MAX_PAGE, ShopListing } from "@/components/store/shop-listing";

/**
 * Sorted and paged shop views. Shoppers never see this URL: next.config.ts
 * rewrites /shop?sort=…&page=… (and /shop/<category>?…) here, so each view is
 * built once and cached instead of rendering on every visit.
 * "_all" stands for the whole shop.
 */
export const revalidate = 300;

export async function generateStaticParams() {
  return []; // built on first visit, then cached
}

type Params = { category: string; sort: string; page: string };

async function resolve(params: Promise<Params>) {
  const { category: slug, sort, page: pageParam } = await params;
  const page = Number(pageParam);
  if (!isSortKey(sort) || !Number.isInteger(page) || page < 1 || page > MAX_PAGE) return null;
  if (slug === "_all") return { category: null, sort, page };
  const category = await findCategory(slug);
  return category ? { category, sort, page } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const view = await resolve(params);
  if (!view) return {};
  return {
    title: view.category ? (view.category.seo_title ?? view.category.name) : "Shop all",
    // Sorting and paging don't make new content for search engines.
    alternates: { canonical: view.category ? `/shop/${view.category.slug}` : "/shop" },
  };
}

export default async function ShopViewPage({ params }: { params: Promise<Params> }) {
  const view = await resolve(params);
  if (!view) notFound();
  return <ShopListing category={view.category} sort={view.sort} page={view.page} />;
}
