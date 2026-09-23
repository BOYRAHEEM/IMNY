/**
 * Payment gateway interface. Checkout and webhooks talk only to this, so the
 * gateway can be swapped (Paystack today) without touching order logic.
 *
 * Rule: the only thing that marks an order paid is `verify()` confirming the
 * payment with the gateway's servers — never a browser redirect or a value
 * sent by the browser.
 */

export type InitializeInput = {
  reference: string;
  email: string;
  amountMinor: number;
  currency: string;
  callbackUrl: string;
  metadata: Record<string, string>;
  /** Payment method the customer picked; the gateway page opens on it. */
  channel: "mobile_money" | "card";
};

export type VerifiedPayment = {
  reference: string;
  status: "success" | "failed" | "abandoned" | "pending";
  amountMinor: number;
  currency: string;
  paidAt: string | null;
  gatewayId: string | null;
};

export type WebhookEvent = {
  id: string;
  type: string;
  reference: string | null;
  payload: unknown;
};

export interface PaymentProvider {
  readonly name: string;
  initialize(input: InitializeInput): Promise<{ authorizationUrl: string }>;
  verify(reference: string): Promise<VerifiedPayment>;
  /** Returns the event only if the signature is valid; otherwise null. */
  parseWebhook(rawBody: string, headers: Headers): WebhookEvent | null;
}

export class PaymentConfigError extends Error {}
