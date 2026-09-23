import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ClearBag } from "@/components/store/clear-bag";
import { logError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { catalogImageUrl } from "@/lib/images";
import { formatMoney } from "@/lib/money";
import { tokenMatches } from "@/lib/order-links";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

const STEPS = ["confirmed", "processing", "ready", "shipped", "delivered"] as const;
const STEP_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  processing: "Being prepared",
  ready: "Ready",
  shipped: "On its way",
  delivered: "Delivered",
};

async function loadOrder(orderNumber: string, token: string) {
  if (!/^[A-Z0-9]{1,6}\d{1,12}$/.test(orderNumber)) return null;
  const { data, error } = await createServiceClient()
    .from("orders")
    .select(
      "id, order_number, access_token_hash, email, shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_region, delivery_zone_name, " +
        "currency, subtotal_minor, delivery_fee_minor, discount_minor, discount_code, total_minor, status, payment_status, created_at, paid_at, " +
        "items:order_items(id, product_name, product_slug, variant_title, image_path, unit_price_minor, quantity, line_total_minor)",
    )
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (error) logError("orderConfirmation.load", error);
  const order = data as unknown as (Record<string, never> & {
    id: string;
    access_token_hash: string;
    items: { id: string; product_name: string; product_slug: string | null; variant_title: string | null; image_path: string | null; unit_price_minor: number; quantity: number; line_total_minor: number }[];
    [k: string]: unknown;
  }) | null;
  // The token is checked in constant time; a wrong token looks exactly like a missing order.
  if (!order || !tokenMatches(token, order.access_token_hash)) return null;
  return order;
}

export default async function OrderConfirmationPage({ searchParams }: PageProps<"/order-confirmation">) {
  const sp = await searchParams;
  const orderNumber = typeof sp.order === "string" ? sp.order : "";
  const token = typeof sp.token === "string" ? sp.token : "";
  const returned = typeof sp.status === "string" ? sp.status : null;

  const ip = await clientIp();
  const allowed = await rateLimit(`order-lookup:${ip}`, 60, 600);
  const order = allowed && orderNumber && token ? await loadOrder(orderNumber, token) : null;

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        {returned === "paid" || returned === "review" ? <ClearBag /> : null}
        <h1 className="font-display text-4xl">
          {returned === "paid" ? "Thank you for your order." : returned === "pending" ? "We're confirming your payment." : "Order not found."}
        </h1>
        <p className="mt-4 text-muted">
          {returned
            ? "Once your payment is confirmed we'll email your receipt with a link to track your order."
            : "Use the link in your order confirmation email to see your order."}
        </p>
        <Link href="/shop" className="mt-8 inline-block text-sm underline underline-offset-4">
          Continue shopping
        </Link>
      </div>
    );
  }

  const o = order as unknown as {
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
    discount_code: string | null;
    total_minor: number;
    status: string;
    payment_status: string;
    created_at: string;
    items: typeof order.items;
  };
  const money = (m: number) => formatMoney(m, o.currency);
  const paid = o.payment_status === "paid";
  const cancelled = o.status === "cancelled";
  const step = STEPS.indexOf(o.status as (typeof STEPS)[number]);

  const heading = cancelled
    ? "This order was cancelled."
    : o.payment_status === "refunded"
      ? "This order was refunded."
      : paid
        ? `Thank you, ${o.shipping_name.split(" ")[0]}.`
        : o.payment_status === "failed"
          ? "Payment wasn't completed."
          : "We're confirming your payment.";

  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      {(paid || o.payment_status === "pending") && !cancelled && <ClearBag />}
      <p className="text-xs tracking-widest text-muted uppercase">Order {o.order_number}</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">{heading}</h1>
      <p className="mt-3 text-ink-soft">
        {paid && !cancelled
          ? `We've emailed your receipt to ${o.email}. Keep it: it has your private link to this page.`
          : o.payment_status === "pending" && !cancelled
            ? "Mobile money payments can take a minute. Refresh this page shortly; we'll also email you once it's confirmed."
            : o.payment_status === "failed" || cancelled
              ? "You haven't been charged for this order."
              : ""}
      </p>

      {paid && !cancelled && (
        <ol className="mt-10 grid grid-cols-5 gap-1" aria-label="Order progress">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined}>
              <span className={`block h-1 ${i <= step ? "bg-ink" : "bg-line"}`} />
              <span className={`mt-2 block text-[11px] leading-tight sm:text-xs ${i <= step ? "text-ink" : "text-faint"}`}>{STEP_LABELS[s]}</span>
            </li>
          ))}
        </ol>
      )}

      <section className="mt-12" aria-label="Items">
        <ul className="divide-y divide-line border-y border-line">
          {o.items.map((i) => {
            const img = catalogImageUrl(i.image_path);
            return (
              <li key={i.id} className="flex gap-4 py-4">
                <div className="relative aspect-[4/5] w-16 shrink-0 bg-mist">
                  {img && <Image src={img} alt="" fill sizes="64px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  {i.product_slug ? (
                    <Link href={`/product/${i.product_slug}`} className="hover:underline">
                      {i.product_name}
                    </Link>
                  ) : (
                    <p>{i.product_name}</p>
                  )}
                  {i.variant_title && <p className="text-muted">{i.variant_title}</p>}
                  <p className="text-muted">Qty {i.quantity}</p>
                </div>
                <p className="text-sm tabular">{money(i.line_total_minor)}</p>
              </li>
            );
          })}
        </ul>
        <dl className="ml-auto mt-4 max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular">{money(o.subtotal_minor)}</dd>
          </div>
          {o.discount_minor > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Discount{o.discount_code ? ` (${o.discount_code})` : ""}</dt>
              <dd className="tabular">−{money(o.discount_minor)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd className="tabular">{o.delivery_fee_minor ? money(o.delivery_fee_minor) : "Free"}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-medium">
            <dt>Total</dt>
            <dd className="tabular">{money(o.total_minor)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-12 grid gap-8 text-sm sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xs tracking-widest text-muted uppercase">Delivering to</h2>
          <address className="not-italic leading-relaxed">
            {o.shipping_name}
            <br />
            {o.shipping_line1}
            {o.shipping_line2 && (
              <>
                <br />
                {o.shipping_line2}
              </>
            )}
            <br />
            {o.shipping_city}, {o.shipping_region}
          </address>
        </div>
        <div>
          <h2 className="mb-2 text-xs tracking-widest text-muted uppercase">Details</h2>
          <p>Placed {formatDateTime(o.created_at)}</p>
          <p>{o.delivery_zone_name}</p>
        </div>
      </section>

      <Link href="/shop" className="mt-14 inline-block text-sm underline underline-offset-4">
        Continue shopping
      </Link>
    </div>
  );
}
