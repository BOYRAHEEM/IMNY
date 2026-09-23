import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopListing } from "@/components/store/shop-listing";
import { getCategories, safely } from "@/lib/queries/catalog";

async function findCategory(slug: string) {
  const categories = await safely("category.lookup", getCategories, []);
  return categories.find((c) => c.slug === slug) ?? null;
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

export default async function CategoryPage({ params, searchParams }: PageProps<"/shop/[category]">) {
  const category = await findCategory((await params).category);
  if (!category) notFound();
  return <ShopListing category={category} searchParams={await searchParams} />;
}
