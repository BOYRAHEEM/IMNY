import type { Metadata } from "next";
import { CheckoutView } from "@/components/store/checkout-view";
import { isDevPaymentsEnabled } from "@/lib/payments/dev";
import { getDeliveryZones, getStoreSettings } from "@/lib/queries/settings";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const [settings, zones, sp] = await Promise.all([getStoreSettings(), getDeliveryZones(), searchParams]);
  return <CheckoutView zones={zones} currency={settings.currency} paymentFailed={sp.payment === "failed"} testPayments={isDevPaymentsEnabled()} />;
}
