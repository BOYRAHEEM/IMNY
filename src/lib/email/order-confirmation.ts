import "server-only";
import { logError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { orderUrl } from "@/lib/order-links";
import { createServiceClient } from "@/lib/supabase/admin";
import { escapeHtml, sendEmail } from "./send";

/** Email the customer their confirmation after payment is verified. */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  try {
    const db = createServiceClient();
    const [{ data: order }, { data: settings }] = await Promise.all([
      db
        .from("orders")
        .select("id, order_number, email, shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_region, delivery_zone_name, currency, subtotal_minor, delivery_fee_minor, discount_minor, total_minor, items:order_items(product_name, variant_title, quantity, line_total_minor)")
        .eq("id", orderId)
        .single(),
      db.from("store_settings").select("store_name, contact_email").single(),
    ]);
    if (!order) return;

    const store = settings?.store_name ?? "Our store";
    const money = (m: number) => formatMoney(m, order.currency);
    const link = orderUrl(order.order_number, order.id);
    const firstName = order.shipping_name.split(" ")[0];
    const e = escapeHtml;

    const rows = order.items
      .map(
        (i) =>
          `<tr><td style="padding:8px 0;border-bottom:1px solid #e6e3de">${e(i.product_name)}${i.variant_title ? `<br><span style="color:#6b6760">${e(i.variant_title)}</span>` : ""} × ${i.quantity}</td><td style="padding:8px 0;border-bottom:1px solid #e6e3de;text-align:right">${money(i.line_total_minor)}</td></tr>`,
      )
      .join("");
    const totals = [
      ["Subtotal", money(order.subtotal_minor)],
      ...(order.discount_minor > 0 ? [["Discount", `−${money(order.discount_minor)}`]] : []),
      [`Delivery (${order.delivery_zone_name})`, order.delivery_fee_minor ? money(order.delivery_fee_minor) : "Free"],
    ]
      .map(([k, v]) => `<tr><td style="padding:4px 0;color:#6b6760">${e(k)}</td><td style="padding:4px 0;text-align:right">${v}</td></tr>`)
      .join("");
    const address = [order.shipping_line1, order.shipping_line2, `${order.shipping_city}, ${order.shipping_region}`].filter(Boolean).map((l) => e(l!)).join("<br>");

    const html = `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:Helvetica,Arial,sans-serif;color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;padding:32px">
<tr><td style="font-family:Georgia,serif;font-size:24px;letter-spacing:3px;text-transform:uppercase;text-align:center;padding-bottom:24px">${e(store)}</td></tr>
<tr><td style="font-size:20px;padding-bottom:8px">Thank you, ${e(firstName)}.</td></tr>
<tr><td style="color:#3d3b38;padding-bottom:24px">We've received your payment for order <strong>${e(order.order_number)}</strong> and we're getting it ready.</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}${totals}
<tr><td style="padding:8px 0;font-weight:bold;border-top:1px solid #141414">Total paid</td><td style="padding:8px 0;font-weight:bold;text-align:right;border-top:1px solid #141414">${money(order.total_minor)}</td></tr></table></td></tr>
<tr><td style="padding-top:24px;font-size:14px;color:#3d3b38"><strong style="color:#141414">Delivering to</strong><br>${address}</td></tr>
<tr><td style="padding-top:28px" align="center"><a href="${e(link)}" style="display:inline-block;background:#141414;color:#fff;text-decoration:none;padding:14px 28px;font-size:13px;letter-spacing:1px;text-transform:uppercase">Track your order</a></td></tr>
<tr><td style="padding-top:28px;font-size:12px;color:#6b6760;text-align:center">Keep this email: the button above is your private link to check your order status.${settings?.contact_email ? ` Questions? Reply or write to ${e(settings.contact_email)}.` : ""}</td></tr>
</table></td></tr></table></body></html>`;

    const text = [
      `Thank you, ${firstName}.`,
      `We've received your payment for order ${order.order_number}.`,
      "",
      ...order.items.map((i) => `${i.product_name}${i.variant_title ? ` (${i.variant_title})` : ""} x${i.quantity}: ${money(i.line_total_minor)}`),
      "",
      `Total paid: ${money(order.total_minor)}`,
      "",
      `Track your order: ${link}`,
    ].join("\n");

    await sendEmail({
      to: order.email,
      subject: `Order ${order.order_number} confirmed`,
      html,
      text,
      replyTo: settings?.contact_email,
    });
  } catch (err) {
    logError("sendOrderConfirmation", err);
  }
}
