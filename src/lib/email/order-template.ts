import { formatMoney } from "@/lib/money";

/**
 * The customer order emails, as plain HTML + text. Kept free of database and
 * server-only imports so it can be unit-tested and previewed.
 * Email clients need tables and inline styles; web fonts fall back to
 * Helvetica / Menlo where they aren't supported.
 */

export type OrderEmailKind = "confirmed" | "shipped";

export type OrderEmailData = {
  kind: OrderEmailKind;
  storeName: string;
  contactEmail: string | null;
  orderNumber: string;
  trackUrl: string;
  shippingName: string;
  address: string[];
  deliveryZone: string;
  currency: string;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  discountMinor: number;
  totalMinor: number;
  cashDue: boolean;
  itemCount: number;
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const C = {
  ink: "#14120f",
  bone: "#fbfaf8",
  card: "#ffffff",
  lime: "#c8f24a",
  violet: "#8b5cf6",
  copy: "#46423b",
  muted: "#8e897f",
  rule: "#e5e2d9",
};
const SANS = "Poppins,Helvetica,Arial,sans-serif";
const MONO = "'IBM Plex Mono',Menlo,Consolas,monospace";
const label = `font-family:${MONO};font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase`;

export function renderOrderEmail(d: OrderEmailData): { subject: string; html: string; text: string } {
  const e = escapeHtml;
  const money = (m: number) => formatMoney(m, d.currency);
  const firstName = d.shippingName.trim().split(/\s+/)[0] ?? "";
  const shipped = d.kind === "shipped";

  const heading = `${shipped ? "it's on the way" : "you ate that"}${firstName ? `, ${firstName}` : ""}`;
  const sub = shipped
    ? "your order has left the studio and is on its way to you."
    : "order confirmed. we'll email you when it's on the way.";
  const strip = shipped ? "ON THE WAY" : "ORDER CONFIRMED";
  const subject = shipped ? `Order ${d.orderNumber} is on the way` : `Order ${d.orderNumber} confirmed`;
  const preheader = shipped ? `${d.orderNumber} is out for delivery.` : `${d.orderNumber} is confirmed. Track it anytime with the link inside.`;

  const stats = [
    ["ORDER", d.orderNumber],
    ["ITEMS", String(d.itemCount)],
    [d.cashDue ? "TO PAY" : "PAID", money(d.totalMinor)],
  ]
    .map(
      ([k, v]) =>
        `<td align="center" style="padding:18px 8px"><div style="${label};color:${C.muted};padding-bottom:6px">${k}</div><div style="font-family:${MONO};font-size:15px;font-weight:600;color:${C.bone}">${e(v)}</div></td>`,
    )
    .join("");

  const totalRow = (k: string, v: string) =>
    `<tr><td style="padding:5px 0;font-family:${SANS};font-size:14px;color:${C.copy}">${e(k)}</td><td align="right" style="padding:5px 0;font-family:${SANS};font-size:14px;color:${C.ink}">${e(v)}</td></tr>`;
  const totals = [
    totalRow("Subtotal", money(d.subtotalMinor)),
    d.discountMinor > 0 ? totalRow("Discount", `−${money(d.discountMinor)}`) : "",
    totalRow(`Delivery · ${d.deliveryZone}`, d.deliveryFeeMinor ? money(d.deliveryFeeMinor) : "FREE"),
  ].join("");

  const cashNote = d.cashDue
    ? `<tr><td style="padding:0 32px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:${C.lime};border-radius:16px;padding:16px 18px;font-family:${SANS};font-size:14px;line-height:1.5;color:${C.ink}"><strong>pay on delivery</strong> · keep <strong>${money(d.totalMinor)}</strong> in cash ready for the rider.</td></tr></table></td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Poppins:wght@500;700&display=swap" rel="stylesheet">
<title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bone};color:${C.ink};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bone}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

<tr><td align="center" style="padding:8px 0 20px">
<div style="font-family:${SANS};font-size:30px;font-weight:700;letter-spacing:-1.5px;color:${C.ink}">${e(d.storeName)}</div>
<div style="font-family:${MONO};font-size:9px;letter-spacing:2px;color:${C.muted};padding-top:2px">EST '26</div>
</td></tr>

<tr><td style="background:${C.card};border:1px solid ${C.rule};border-radius:24px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="background:${C.violet};border-radius:23px 23px 0 0;padding:10px 16px;${label};letter-spacing:3px;color:#ffffff">${strip} &nbsp;✦&nbsp; ${e(d.orderNumber)}</td></tr>

<tr><td align="center" style="padding:36px 32px 8px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="56" height="56" style="width:56px;height:56px;border-radius:28px;background:${C.lime};font-size:0;line-height:0">&nbsp;</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:16px 32px 10px;font-family:${SANS};font-size:34px;line-height:1;font-weight:700;letter-spacing:-1.5px;color:${C.ink}">${e(heading)}</td></tr>
<tr><td align="center" style="padding:0 40px 28px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.copy}">${e(sub)}</td></tr>

<tr><td style="padding:0 32px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ink};border-radius:18px"><tr>${stats}</tr></table></td></tr>
${cashNote}
<tr><td style="padding:0 32px"><div style="${label};color:${C.muted};padding-bottom:4px">summary</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${totals}
<tr><td style="padding:12px 0 0;border-top:1px solid ${C.ink};font-family:${SANS};font-size:15px;font-weight:700;color:${C.ink}">${d.cashDue ? "To pay on delivery" : "Total paid"}</td><td align="right" style="padding:12px 0 0;border-top:1px solid ${C.ink};font-family:${SANS};font-size:20px;font-weight:700;letter-spacing:-0.5px;color:${C.ink}">${money(d.totalMinor)}</td></tr>
</table></td></tr>

<tr><td style="padding:28px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bone};border-radius:16px"><tr><td style="padding:16px 18px">
<div style="${label};color:${C.muted};padding-bottom:8px">delivering to</div>
<div style="font-family:${SANS};font-size:14px;line-height:1.6;color:${C.ink}"><strong>${e(d.shippingName)}</strong><br>${d.address.map(e).join("<br>")}</div>
</td></tr></table></td></tr>

<tr><td align="center" style="padding:28px 32px 32px">
<a href="${e(d.trackUrl)}" style="display:inline-block;background:${C.lime};color:${C.ink};text-decoration:none;padding:16px 34px;border-radius:999px;border:1.5px solid ${C.ink};font-family:${MONO};font-size:12px;font-weight:600;letter-spacing:3px">TRACK YOUR ORDER →</a>
<div style="font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted};padding-top:14px">this button is your private link to your order, so keep this email.</div>
</td></tr>
</table></td></tr>

<tr><td align="center" style="padding:22px 16px 8px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted}">
${d.contactEmail ? `questions? just reply, or write to <a href="mailto:${e(d.contactEmail)}" style="color:${C.ink}">${e(d.contactEmail)}</a>.<br>` : "questions? just reply to this email.<br>"}
<span style="font-family:${MONO};font-size:10px;letter-spacing:2px">© ${new Date().getFullYear()} ${e(d.storeName.toUpperCase())} · ACCRA</span>
</td></tr>

</table></td></tr></table></body></html>`;

  const text = [
    heading,
    sub,
    d.cashDue ? `Pay on delivery: keep ${money(d.totalMinor)} in cash ready for the rider.` : "",
    "",
    `Order ${d.orderNumber}`,
    `Items: ${d.itemCount}`,
    `Subtotal: ${money(d.subtotalMinor)}`,
    ...(d.discountMinor > 0 ? [`Discount: −${money(d.discountMinor)}`] : []),
    `Delivery (${d.deliveryZone}): ${d.deliveryFeeMinor ? money(d.deliveryFeeMinor) : "Free"}`,
    `${d.cashDue ? "To pay on delivery" : "Total paid"}: ${money(d.totalMinor)}`,
    "",
    `Delivering to: ${[d.shippingName, ...d.address].join(", ")}`,
    "",
    `Track your order: ${d.trackUrl}`,
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n");

  return { subject, html, text };
}
