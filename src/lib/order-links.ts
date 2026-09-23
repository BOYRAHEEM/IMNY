import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * Private order links (there are no customer accounts).
 *
 * token = HMAC-SHA256(ORDER_LINK_SECRET, order id). It can be regenerated at
 * any time (e.g. for emails) without being stored; the database keeps only
 * its SHA-256 hash. Without the secret, tokens can't be guessed or forged.
 */

export function orderToken(orderId: string): string {
  return createHmac("sha256", serverEnv("ORDER_LINK_SECRET")).update(`order:${orderId}`).digest("base64url");
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: string, storedHash: string): boolean {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return false;
  const a = Buffer.from(tokenHash(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function orderUrl(orderNumber: string, orderId: string): string {
  const q = new URLSearchParams({ order: orderNumber, token: orderToken(orderId) });
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}/order-confirmation?${q}`;
}
