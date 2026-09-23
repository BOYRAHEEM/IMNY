import type { Metadata } from "next";
import { CheckoutView } from "@/components/store/checkout-view";
import { isDevPaymentsEnabled } from "@/lib/payments/dev";
import { getDeliveryZones, getStoreSettings } from "@/lib/queries/settings";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const [settings, zones, sp] = await Promise.all([getStoreSettings(), getDeliveryZones(), searchParams]);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:px-10">
      <h1 className="mb-8 font-display text-4xl sm:text-5xl">Checkout</h1>
      <CheckoutView zones={zones} currency={settings.currency} paymentFailed={sp.payment === "failed"} testPayments={isDevPaymentsEnabled()} />
    </div>
  );
}
