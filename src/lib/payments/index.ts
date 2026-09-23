import "server-only";
import { devProvider, isDevPaymentsEnabled } from "./dev";
import { paystack } from "./paystack";
import { PaymentConfigError, type PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider {
  if (isDevPaymentsEnabled()) return devProvider;
  if (!/^sk_(test|live)_/.test(process.env.PAYSTACK_SECRET_KEY ?? "")) {
    throw new PaymentConfigError("PAYSTACK_SECRET_KEY is not configured");
  }
  return paystack;
}

export { PaymentConfigError } from "./types";
export type { PaymentProvider, VerifiedPayment } from "./types";
