import type { Metadata } from "next";
import { ShopListing } from "@/components/store/shop-listing";

// Prebuilt and cached; refreshed when products or stock change (cache tags)
// or every 5 minutes. Sorted and paged views live in /shop-view.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Shop all",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  return <ShopListing category={null} />;
}
