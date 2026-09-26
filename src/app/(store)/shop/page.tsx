import type { Metadata } from "next";
import { ShopListing } from "@/components/store/shop-listing";

// Prebuilt and cached; refreshed when products or stock change (cache tags)
// or every 5 minutes. Sorting happens on the device (see ShopGrid).
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Shop all",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  return <ShopListing category={null} />;
}
