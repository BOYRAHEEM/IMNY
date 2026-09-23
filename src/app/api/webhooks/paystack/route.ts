import { NextResponse, type NextRequest } from "next/server";
import { confirmPayment } from "@/lib/checkout/confirm-payment";
import { logError } from "@/lib/errors";
import { paystack } from "@/lib/payments/paystack";
import { createServiceClient } from "@/lib/supabase/admin";

/**
 * Paystack webhook. Authenticated by the HMAC-SHA512 signature over the raw
 * body; anything unsigned is rejected. Even for signed events we verify the
 * transaction with Paystack's API before marking an order paid.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 100_000) return new NextResponse(null, { status: 413 });

  let event;
  try {
    event = paystack.parseWebhook(raw, request.headers);
  } catch (err) {
    logError("webhook.paystack.config", err);
    return new NextResponse(null, { status: 500 });
  }
  if (!event) return new NextResponse(null, { status: 401 });

  const db = createServiceClient();
  // Record every event once; a duplicate delivery hits the unique constraint.
  const { data: inserted, error } = await db
    .from("payment_events")
    .upsert(
      { provider: "paystack", event_type: event.type, reference: event.reference, provider_event_id: event.id, payload: event.payload as never },
      { onConflict: "provider,provider_event_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) {
    logError("webhook.paystack.store", error);
    return new NextResponse(null, { status: 500 }); // Paystack will retry
  }

  let eventRowId = inserted?.[0]?.id;
  if (!eventRowId) {
    // Seen before: skip only if it was fully processed last time.
    const { data: existing } = await db
      .from("payment_events")
      .select("id, processed_at")
      .eq("provider", "paystack")
      .eq("provider_event_id", event.id)
      .single();
    if (!existing || existing.processed_at) return NextResponse.json({ received: true, duplicate: true });
    eventRowId = existing.id;
  }

  if (event.type === "charge.success" && event.reference) {
    const outcome = await confirmPayment(event.reference);
    if (outcome === "pending") {
      // Couldn't confirm with Paystack yet; a non-2xx makes Paystack retry later.
      return new NextResponse(null, { status: 503 });
    }
    await db
      .from("payment_events")
      .update({ processed_at: new Date().toISOString(), error: outcome === "paid" ? null : outcome })
      .eq("id", eventRowId);
  } else {
    await db.from("payment_events").update({ processed_at: new Date().toISOString() }).eq("id", eventRowId);
  }

  return NextResponse.json({ received: true });
}
