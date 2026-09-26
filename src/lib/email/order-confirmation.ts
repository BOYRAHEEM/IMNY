import "server-only";
import { logError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { orderUrl } from "@/lib/order-links";
import { createServiceClient } from "@/lib/supabase/admin";
import { escapeHtml, sendEmail } from "./send";

type Kind = "confirmed" | "shipped";

/**
 * Customer emails. "confirmed" is sent once payment is verified (or straight
 * away for pay-on-delivery); "shipped" when staff mark the order shipped.
 */
async function sendOrderEmail(orderId: string, kind: Kind): Promise<void> {
  try {
    const db = createServiceClient();
    const [{ data: order }, { data: settings }] = await Promise.all([
      db
        .from("orders")
        .select(
          "id, order_number, email, shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_region, delivery_zone_name, " +
            "currency, subtotal_minor, delivery_fee_minor, discount_minor, total_minor, payment_method, payment_status, " +
            "items:order_items(product_name, variant_title, quantity, line_total_minor)",
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
      items: { product_name: string; variant_title: string | null; quantity: number; line_total_minor: number }[];
    };

    const store = settings?.store_name ?? "Our store";
    const money = (m: number) => formatMoney(m, o.currency);
    const link = orderUrl(o.order_number, o.id);
    const firstName = o.shipping_name.split(" ")[0];
    const cashDue = o.payment_method === "cod" && o.payment_status !== "paid";
    const e = escapeHtml;

    const headline = kind === "shipped" ? `It's on the way, ${firstName}.` : `You ate that, ${firstName}.`;
    const intro =
      kind === "shipped"
        ? `Order <strong>${e(o.order_number)}</strong> has left the studio and is on its way to you.${cashDue ? ` Please have <strong>${money(o.total_minor)}</strong> in cash ready for the rider.` : ""}`
        : `Order <strong>${e(o.order_number)}</strong> confirmed.${cashDue ? ` Keep <strong>${money(o.total_minor)}</strong> in cash ready for the rider.` : ""} We'll email you when it's on the way.`;
    const subject = kind === "shipped" ? `Order ${o.order_number} is on the way` : `Order ${o.order_number} confirmed`;

    const rows = o.items
      .map(
        (i) =>
          `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e2d9">${e(i.product_name)}${i.variant_title ? `<br><span style="color:#6f6b63">${e(i.variant_title)}</span>` : ""} × ${i.quantity}</td><td style="padding:8px 0;border-bottom:1px solid #e5e2d9;text-align:right">${money(i.line_total_minor)}</td></tr>`,
      )
      .join("");
    const totals = [
      ["Subtotal", money(o.subtotal_minor)],
      ...(o.discount_minor > 0 ? [["Discount", `−${money(o.discount_minor)}`]] : []),
      [`Delivery (${o.delivery_zone_name})`, o.delivery_fee_minor ? money(o.delivery_fee_minor) : "Free"],
    ]
      .map(([k, v]) => `<tr><td style="padding:4px 0;color:#6f6b63">${e(k)}</td><td style="padding:4px 0;text-align:right">${v}</td></tr>`)
      .join("");
    const address = [o.shipping_line1, o.shipping_line2, `${o.shipping_city}, ${o.shipping_region}`].filter(Boolean).map((l) => e(l!)).join("<br>");

    const html = `<!doctype html><html><body style="margin:0;background:#fbfaf8;font-family:Helvetica,Arial,sans-serif;color:#14120f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:24px;padding:32px">
<tr><td style="font-size:26px;font-weight:700;letter-spacing:-1.5px;padding-bottom:24px">${e(store)}</td></tr>
<tr><td style="font-size:22px;font-weight:700;letter-spacing:-0.5px;padding-bottom:8px">${e(headline)}</td></tr>
<tr><td style="color:#46423b;padding-bottom:24px;line-height:1.6">${intro}</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}${totals}
<tr><td style="padding:10px 0;font-weight:bold;border-top:1px solid #14120f">${cashDue ? "To pay on delivery" : "Total paid"}</td><td style="padding:10px 0;font-weight:bold;text-align:right;border-top:1px solid #14120f">${money(o.total_minor)}</td></tr></table></td></tr>
<tr><td style="padding-top:24px;font-size:14px;color:#46423b"><strong style="color:#14120f">Delivering to</strong><br>${address}</td></tr>
<tr><td style="padding-top:28px" align="center"><a href="${e(link)}" style="display:inline-block;background:#14120f;color:#fbfaf8;text-decoration:none;padding:16px 32px;border-radius:999px;font-family:Menlo,monospace;font-size:12px;font-weight:600;letter-spacing:3px">TRACK YOUR ORDER</a></td></tr>
<tr><td style="padding-top:28px;font-size:12px;color:#8e897f;text-align:center">Keep this email: the button is your private link to check your order.${settings?.contact_email ? ` Questions? Reply or write to ${e(settings.contact_email)}.` : ""}</td></tr>
</table></td></tr></table></body></html>`;

    const text = [
      headline,
      intro.replace(/<[^>]+>/g, ""),
      "",
      ...o.items.map((i) => `${i.product_name}${i.variant_title ? ` (${i.variant_title})` : ""} x${i.quantity}: ${money(i.line_total_minor)}`),
      "",
      `${cashDue ? "To pay on delivery" : "Total paid"}: ${money(o.total_minor)}`,
      "",
      `Track your order: ${link}`,
    ].join("\n");

    await sendEmail({ to: o.email, subject, html, text, replyTo: settings?.contact_email });
  } catch (err) {
    logError(`sendOrderEmail.${kind}`, err);
  }
}

export const sendOrderConfirmation = (orderId: string) => sendOrderEmail(orderId, "confirmed");
export const sendOrderShipped = (orderId: string) => sendOrderEmail(orderId, "shipped");
