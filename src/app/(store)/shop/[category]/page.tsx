import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findCategory, ShopListing } from "@/components/store/shop-listing";
import { getCategories, safely } from "@/lib/queries/catalog";

// Prebuilt and cached like /shop. Sorted and paged views live in /shop-view.
export const revalidate = 300;

export async function generateStaticParams() {
  const categories = await safely("category.staticParams", getCategories, []);
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/shop/[category]">): Promise<Metadata> {
  const category = await findCategory((await params).category);
  if (!category) return {};
  return {
    title: category.seo_title ?? category.name,
    description: category.seo_description ?? category.description ?? undefined,
    alternates: { canonical: `/shop/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: PageProps<"/shop/[category]">) {
  const category = await findCategory((await params).category);
  if (!category) notFound();
  return <ShopListing category={category} />;
}
