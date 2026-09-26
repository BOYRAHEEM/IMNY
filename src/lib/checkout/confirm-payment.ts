import "server-only";
import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { sendOrderConfirmation } from "@/lib/email/order-confirmation";
import { logError } from "@/lib/errors";
import { getPaymentProvider } from "@/lib/payments";
import { createServiceClient } from "@/lib/supabase/admin";

export type PaymentOutcome = "paid" | "pending" | "failed" | "review" | "not_found";

/**
 * Ask the gateway (server to server) whether this payment succeeded, and
 * update the order. Used by both the customer's return redirect and the
 * gateway webhook; safe to call any number of times for the same reference.
 */
export async function confirmPayment(reference: string): Promise<PaymentOutcome> {
  const db = createServiceClient();

  let verified;
  try {
    verified = await getPaymentProvider().verify(reference);
  } catch (err) {
    logError("confirmPayment.verify", err);
    return "pending"; // gateway unreachable: the webhook or a retry will settle it
  }

  if (verified.status === "success") {
    const { data, error } = await db.rpc("mark_order_paid", {
      p_reference: reference,
      p_amount_minor: verified.amountMinor,
      p_currency: verified.currency,
      p_paid_at: verified.paidAt ?? undefined,
    });
    if (error) {
      logError("confirmPayment.markPaid", error);
      return "pending";
    }
    const result = data as { ok: boolean; error?: string; order_id?: string; already_processed?: boolean; stock_committed?: boolean };
    revalidateTag(TAGS.stock, { expire: 0 });
    if (!result.ok) return result.error === "ORDER_NOT_FOUND" ? "not_found" : "review";
    // Also on repeats: the email is sent at most once, so this completes a
    // send that an earlier run didn't finish.
    if (result.order_id) await sendOrderConfirmation(result.order_id);
    return result.stock_committed === false ? "review" : "paid";
  }

  if (verified.status === "failed") {
    const { error } = await db.rpc("mark_order_payment_failed", { p_reference: reference });
    if (error) logError("confirmPayment.markFailed", error);
    revalidateTag(TAGS.stock, { expire: 0 });
    return "failed";
  }

  // "pending" or "abandoned": leave it; the stock hold expires on its own.
  return "pending";
}
