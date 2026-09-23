import type { Metadata } from "next";
import { BagView } from "@/components/store/bag-view";
import { getStoreSettings } from "@/lib/queries/settings";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default async function CartPage() {
  const settings = await getStoreSettings();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:px-10">
      <h1 className="mb-8 font-display text-4xl sm:text-5xl">Your bag</h1>
      <BagView maxQuantity={settings.max_quantity_per_item} />
    </div>
  );
}
