import "server-only";
import { publicEnv } from "@/lib/env";
import type { PaymentProvider, VerifiedPayment } from "./types";

/**
 * LOCAL DEVELOPMENT ONLY. Simulates a payment gateway so checkout can be
 * tested end to end without real keys. Selected only when NODE_ENV is
 * "development" AND PAYMENT_PROVIDER=dev (see ./index.ts); in any other
 * environment it is unreachable.
 */

type DevPayment = { amountMinor: number; currency: string; outcome: "pending" | "success" | "failed" };

// Survives hot reloads in `next dev`.
const store: Map<string, DevPayment> = ((globalThis as Record<string, unknown>).__devPayments ??= new Map()) as Map<string, DevPayment>;

export function isDevPaymentsEnabled() {
  return process.env.NODE_ENV === "development" && process.env.PAYMENT_PROVIDER === "dev";
}

export function setDevOutcome(reference: string, outcome: "success" | "failed") {
  if (!isDevPaymentsEnabled()) throw new Error("Dev payments are disabled");
  const p = store.get(reference);
  if (p) p.outcome = outcome;
}

export function getDevPayment(reference: string) {
  return isDevPaymentsEnabled() ? store.get(reference) ?? null : null;
}

export const devProvider: PaymentProvider = {
  name: "dev",

  async initialize(input) {
    if (!isDevPaymentsEnabled()) throw new Error("Dev payments are disabled");
    store.set(input.reference, { amountMinor: input.amountMinor, currency: input.currency, outcome: "pending" });
    return { authorizationUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/checkout/dev-pay?reference=${encodeURIComponent(input.reference)}` };
  },

  async verify(reference): Promise<VerifiedPayment> {
    const p = getDevPayment(reference);
    return {
      reference,
      status: p?.outcome ?? "failed",
      amountMinor: p?.amountMinor ?? 0,
      currency: p?.currency ?? "GHS",
      paidAt: p?.outcome === "success" ? new Date().toISOString() : null,
      gatewayId: null,
    };
  },

  parseWebhook() {
    return null;
  },
};
