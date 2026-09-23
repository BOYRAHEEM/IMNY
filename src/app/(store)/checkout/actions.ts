"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { cartLinesSchema, priceCart, type Quote } from "@/lib/checkout/quote";
import { publicEnv } from "@/lib/env";
import { GENERIC_ERROR, logError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { orderToken, tokenHash } from "@/lib/order-links";
import { getPaymentProvider, PaymentConfigError } from "@/lib/payments";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/admin";
import { checkoutSchema } from "@/lib/validation/checkout";

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; error: string };

/** Re-price the bag on the server. Called by the bag and checkout pages. */
export async function getQuote(input: {
  lines: unknown;
  zoneId?: string | null;
  code?: string | null;
  email?: string | null;
}): Promise<QuoteResult> {
  const parsed = cartLinesSchema.safeParse(input.lines);
  if (!parsed.success) return { ok: false, error: "Your bag couldn't be read. Please refresh the page." };

  const ip = await clientIp();
  if (!(await rateLimit(`quote:${ip}`, 120, 60))) return { ok: false, error: "Too many requests. Please wait a moment." };
  const code = input.code?.trim().slice(0, 32) || null;
  // Discount codes get a tighter limit so they can't be guessed by brute force.
  if (code && !(await rateLimit(`discount:${ip}`, 20, 600))) {
    return { ok: false, error: "Too many discount attempts. Please wait a few minutes." };
  }

  try {
    const quote = await priceCart(parsed.data, {
      zoneId: input.zoneId && /^[0-9a-f-]{36}$/i.test(input.zoneId) ? input.zoneId : null,
      code,
      email: input.email?.slice(0, 254) ?? null,
      format: formatMoney,
    });
    return { ok: true, quote };
  } catch (err) {
    logError("getQuote", err);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export type PlaceOrderResult =
  | { ok: false; error: string; fieldErrors?: Record<string, string>; quote?: Quote }
  | { ok: true };

const INPUT_ERRORS: Record<string, string> = {
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_PHONE: "Enter a valid phone number.",
  INVALID_NAME: "Enter your full name.",
  INVALID_ADDRESS: "Enter your delivery address.",
  DELIVERY_ZONE_REQUIRED: "Choose a delivery option.",
  GUEST_CHECKOUT_DISABLED: "Checkout is temporarily unavailable.",
};

export async function placeOrder(form: Record<string, unknown>, lines: unknown): Promise<PlaceOrderResult> {
  const parsedLines = cartLinesSchema.safeParse(lines);
  if (!parsedLines.success) return { ok: false, error: "Your bag is empty or couldn't be read." };

  const parsed = checkoutSchema.safeParse(form);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Please check the highlighted details.", fieldErrors };
  }
  const f = parsed.data;

  const ip = await clientIp();
  const [ipOk, emailOk] = await Promise.all([
    rateLimit(`checkout:ip:${ip}`, 15, 600),
    rateLimit(`checkout:email:${f.email}`, 8, 600),
  ]);
  if (!ipOk || !emailOk) return { ok: false, error: "Too many checkout attempts. Please wait a few minutes and try again." };

  let provider;
  try {
    provider = getPaymentProvider();
  } catch (err) {
    logError("placeOrder.provider", err);
    return {
      ok: false,
      error: err instanceof PaymentConfigError ? "Online payment isn't available right now. Please try again later." : GENERIC_ERROR,
    };
  }

  const db = createServiceClient();
  // Free up stock from abandoned checkouts first (its own transaction).
  const { error: releaseError } = await db.rpc("release_expired_reservations");
  if (releaseError) logError("placeOrder.release", releaseError);

  const reference = `${provider.name === "dev" ? "DEV" : "IM"}_${randomBytes(12).toString("hex")}`;
  // The token depends on the order id, which we only learn after inserting;
  // store a placeholder hash, then set the real one immediately after.
  const placeholder = tokenHash(randomBytes(32).toString("base64url"));

  const { data, error } = await db.rpc("place_order", {
    p_items: parsedLines.data,
    p_customer: { email: f.email, phone: f.phone, name: f.name },
    p_shipping: {
      line1: f.line1,
      line2: f.line2,
      city: f.city,
      region: f.region,
      digital_address: f.digital_address,
      instructions: f.instructions,
    },
    p_delivery_zone_id: f.zone_id,
    // Both accept NULL in SQL (no code / no account); the generated types don't express that.
    p_discount_code: f.discount_code as string,
    p_user_id: null as unknown as string,
    p_payment_provider: provider.name,
    p_payment_reference: reference,
    p_access_token_hash: placeholder,
  });

  if (error) {
    const code = error.message?.match(/^[A-Z_]+$/)?.[0];
    if (code && INPUT_ERRORS[code]) return { ok: false, error: INPUT_ERRORS[code] };
    logError("placeOrder.rpc", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  const result = data as {
    ok: boolean;
    error?: string;
    quote?: unknown;
    order_id?: string;
    order_number?: string;
    total_minor?: number;
    currency?: string;
  };

  if (!result.ok) {
    // Something changed (stock, price, discount). Return a fresh quote so the page can explain.
    const fresh = await getQuote({ lines: parsedLines.data, zoneId: f.zone_id, code: f.discount_code, email: f.email });
    return {
      ok: false,
      error: "Your bag changed while you were checking out. Please review it and try again.",
      quote: fresh.ok ? fresh.quote : undefined,
    };
  }

  const orderId = result.order_id!;
  const orderNumber = result.order_number!;
  const token = orderToken(orderId);
  const { error: tokenError } = await db.from("orders").update({ access_token_hash: tokenHash(token) }).eq("id", orderId);
  if (tokenError) logError("placeOrder.token", tokenError);

  updateTag(TAGS.stock);

  let authorizationUrl: string;
  try {
    ({ authorizationUrl } = await provider.initialize({
      reference,
      email: f.email,
      amountMinor: result.total_minor!,
      currency: result.currency!,
      callbackUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/checkout/return`,
      metadata: { order_id: orderId, order_number: orderNumber },
    }));
  } catch (err) {
    logError("placeOrder.initialize", err);
    // Give the stock back straight away.
    const { error: failError } = await db.rpc("mark_order_payment_failed", { p_reference: reference });
    if (failError) logError("placeOrder.release", failError);
    updateTag(TAGS.stock);
    return { ok: false, error: "We couldn't start the payment. You haven't been charged. Please try again." };
  }

  // Lets the return page show this order's details in this browser.
  (await cookies()).set("imny_order", `${orderNumber}.${token}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect(authorizationUrl);
}
