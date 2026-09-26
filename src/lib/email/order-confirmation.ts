import "server-only";
import { logError } from "@/lib/errors";
import { orderUrl } from "@/lib/order-links";
import { createServiceClient } from "@/lib/supabase/admin";
import { catalogImageUrl } from "@/lib/images";
import { renderOrderEmail, type OrderEmailKind } from "./order-template";
import { sendEmail } from "./send";

/**
 * Customer emails. "confirmed" is sent once payment is verified (or straight
 * away for pay-on-delivery); "shipped" when staff mark the order shipped.
 * Each is sent at most once per order, so callers may call this freely.
 */
async function sendOrderEmail(orderId: string, kind: OrderEmailKind): Promise<void> {
  const db = createServiceClient();
  // Claim the send first. A second caller (retry, double click, webhook and
  // return page together) finds the row already there and stops.
  const { data: claimed, error: claimError } = await db
    .from("order_emails")
    .upsert({ order_id: orderId, kind }, { onConflict: "order_id,kind", ignoreDuplicates: true })
    .select("order_id");
  if (claimError) {
    logError(`sendOrderEmail.${kind}.claim`, claimError);
    return;
  }
  if (!claimed?.length) return;

  let sent = false;
  try {
    const [{ data: order }, { data: settings }] = await Promise.all([
      db
        .from("orders")
        .select(
          "id, order_number, email, shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_region, delivery_zone_name, " +
            "currency, subtotal_minor, delivery_fee_minor, discount_minor, total_minor, payment_method, payment_status, " +
            "items:order_items(product_name, variant_title, quantity, line_total_minor, image_path)",
        )
        .eq("id", orderId)
        .single(),
      db.from("store_settings").select("store_name, contact_email").single(),
    ]);
    if (!order) return;
    const o = order as unknown as {
      id: string;
      order_number: string;
      email: string;
      shipping_name: string;
      shipping_line1: string;
      shipping_line2: string | null;
      shipping_city: string;
      shipping_region: string;
      delivery_zone_name: string;
      currency: string;
      subtotal_minor: number;
      delivery_fee_minor: number;
      discount_minor: number;
      total_minor: number;
      payment_method: string;
      payment_status: string;
      items: { product_name: string; variant_title: string | null; quantity: number; line_total_minor: number; image_path: string | null }[];
    };

    const { subject, html, text } = renderOrderEmail({
      kind,
      storeName: settings?.store_name ?? "IMNY",
      contactEmail: settings?.contact_email ?? null,
      orderNumber: o.order_number,
      trackUrl: orderUrl(o.order_number, o.id),
      shippingName: o.shipping_name,
      address: [o.shipping_line1, o.shipping_line2, `${o.shipping_city}, ${o.shipping_region}`].filter((l): l is string => Boolean(l)),
      deliveryZone: o.delivery_zone_name,
      currency: o.currency,
      subtotalMinor: o.subtotal_minor,
      deliveryFeeMinor: o.delivery_fee_minor,
      discountMinor: o.discount_minor,
      totalMinor: o.total_minor,
      cashDue: o.payment_method === "cod" && o.payment_status !== "paid",
      items: o.items.map((i) => ({
        name: i.product_name,
        variant: i.variant_title,
        quantity: i.quantity,
        lineTotalMinor: i.line_total_minor,
        imageUrl: catalogImageUrl(i.image_path),
      })),
    });

    ({ sent } = await sendEmail({
      to: o.email,
      subject,
      html,
      text,
      replyTo: settings?.contact_email,
      idempotencyKey: `order-${kind}/${orderId}`,
    }));
  } catch (err) {
    logError(`sendOrderEmail.${kind}`, err);
  } finally {
    if (!sent) {
      // Release the claim so a later retry can send it.
      const { error } = await db.from("order_emails").delete().eq("order_id", orderId).eq("kind", kind);
      if (error) logError(`sendOrderEmail.${kind}.release`, error);
    }
  }
}

export const sendOrderConfirmation = (orderId: string) => sendOrderEmail(orderId, "confirmed");
export const sendOrderShipped = (orderId: string) => sendOrderEmail(orderId, "shipped");
