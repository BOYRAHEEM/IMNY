import type { Metadata } from "next";
import { ShopListing } from "@/components/store/shop-listing";

export const metadata: Metadata = {
  title: "Shop all",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  return <ShopListing category={null} searchParams={await searchParams} />;
}
