import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env.server";
import type { InitializeInput, PaymentProvider, VerifiedPayment, WebhookEvent } from "./types";

const API = "https://api.paystack.co";

type PaystackResponse<T> = { status: boolean; message: string; data: T };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${serverEnv("PAYSTACK_SECRET_KEY")}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as PaystackResponse<T> | null;
  if (!res.ok || !body?.status) {
    throw new Error(`Paystack ${path} failed: ${res.status} ${body?.message ?? ""}`.trim());
  }
  return body.data;
}

export const paystack: PaymentProvider = {
  name: "paystack",

  async initialize(input: InitializeInput) {
    const data = await call<{ authorization_url: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: input.amountMinor, // Paystack takes the lowest unit (pesewas)
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
        channels: ["card", "mobile_money", "bank", "bank_transfer", "ussd"],
      }),
    });
    return { authorizationUrl: data.authorization_url };
  },

  async verify(reference: string): Promise<VerifiedPayment> {
    const data = await call<{
      id: number;
      status: string;
      amount: number;
      currency: string;
      paid_at: string | null;
      reference: string;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`);
    const status =
      data.status === "success" ? "success" : data.status === "failed" ? "failed" : data.status === "abandoned" ? "abandoned" : "pending";
    return {
      reference: data.reference,
      status,
      amountMinor: data.amount,
      currency: data.currency,
      paidAt: data.paid_at,
      gatewayId: String(data.id),
    };
  },

  parseWebhook(rawBody: string, headers: Headers): WebhookEvent | null {
    const signature = headers.get("x-paystack-signature") ?? "";
    const expected = createHmac("sha512", serverEnv("PAYSTACK_SECRET_KEY")).update(rawBody).digest("hex");
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    let body: { event?: string; data?: { id?: number; reference?: string } };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return null;
    }
    if (!body.event) return null;
    return {
      id: `${body.event}:${body.data?.id ?? body.data?.reference ?? "unknown"}`,
      type: body.event,
      reference: body.data?.reference ?? null,
      payload: body,
    };
  },
};
