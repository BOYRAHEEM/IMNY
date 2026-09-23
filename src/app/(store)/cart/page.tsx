import type { Metadata } from "next";
import { BagView } from "@/components/store/bag-view";
import { deliverySummary, getDeliveryZones, getStoreSettings } from "@/lib/queries/settings";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default async function CartPage() {
  const [settings, zones] = await Promise.all([getStoreSettings(), getDeliveryZones()]);
  const { freeOver, flatFee, minFee, codZones } = deliverySummary(settings, zones);
  const badges = [
    "mobile money",
    "card",
    ...(codZones.length ? [`pay on delivery · ${codZones.map((z) => z.toLowerCase()).join(", ")}`] : []),
    settings.content.returns_badge,
  ];

  return (
    <BagView
      maxQuantity={settings.max_quantity_per_item}
      currency={settings.currency}
      freeOverMinor={freeOver}
      deliveryFeeMinor={flatFee ?? minFee}
      flatDelivery={flatFee !== null}
      badges={badges}
    />
  );
}
