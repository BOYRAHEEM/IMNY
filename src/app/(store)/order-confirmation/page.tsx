import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ClearBag } from "@/components/store/clear-bag";
import { Confetti } from "@/components/store/confetti";
import { ui } from "@/components/store/ui";
import { cn } from "@/lib/cn";
import { logError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { catalogImageUrl } from "@/lib/images";
import { formatMoney } from "@/lib/money";
import { tokenMatches } from "@/lib/order-links";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

const STEPS = [
  { key: "confirmed", label: "confirmed" },
  { key: "processing", label: "packing" },
  { key: "ready", label: "ready" },
  { key: "shipped", label: "on the way" },
  { key: "delivered", label: "delivered" },
] as const;

type Order = {
  id: string;
  order_number: string;
  access_token_hash: string;
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
  payment_method: string;
  created_at: string;
  items: { id: string; product_name: string; product_slug: string | null; variant_title: string | null; image_path: string | null; quantity: number; line_total_minor: number }[];
};

async function loadOrder(orderNumber: string, token: string): Promise<Order | null> {
  if (!/^[A-Z0-9]{1,6}-?\d{1,12}$/.test(orderNumber)) return null;
  const { data, error } = await createServiceClient()
    .from("orders")
    .select(
      "id, order_number, access_token_hash, email, shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_region, delivery_zone_name, " +
        "currency, subtotal_minor, delivery_fee_minor, discount_minor, discount_code, total_minor, status, payment_status, payment_method, created_at, " +
        "items:order_items(id, product_name, product_slug, variant_title, image_path, quantity, line_total_minor)",
    )
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (error) logError("orderConfirmation.load", error);
  const order = data as unknown as Order | null;
  // Constant-time check; a wrong token looks exactly like a missing order.
  if (!order || !tokenMatches(token, order.access_token_hash)) return null;
  return order;
}

function Badge() {
  return <div aria-hidden className="size-[72px] rounded-full bg-lime" />;
}

export default async function OrderConfirmationPage({ searchParams }: PageProps<"/order-confirmation">) {
  const sp = await searchParams;
  const orderNumber = typeof sp.order === "string" ? sp.order : "";
  const token = typeof sp.token === "string" ? sp.token : "";
  const returned = typeof sp.status === "string" ? sp.status : null;

  const allowed = await rateLimit(`order-lookup:${await clientIp()}`, 60, 600);
  const order = allowed && orderNumber && token ? await loadOrder(orderNumber, token) : null;

  if (!order) {
    const thanks = returned === "paid" || returned === "review";
    return (
      <section className="flex flex-col items-center gap-7 px-[22px] py-[clamp(48px,9vw,120px)] text-center">
        {thanks && <ClearBag />}
        {thanks && <Confetti />}
        <Badge />
        <div>
          <h1 className="mt-0 mb-3.5 text-[clamp(36px,7vw,72px)] leading-[0.95] font-bold tracking-[-0.06em]">
            {thanks ? "it's yours now" : returned === "pending" ? "almost there" : "order not found"}
          </h1>
          <p className="m-0 max-w-[46ch] text-[17px] leading-[1.6] text-copy">
            {returned
              ? "once your payment is confirmed we'll email your receipt with a private link to track your order."
              : "use the link in your order email to see your order."}
          </p>
        </div>
        <Link href="/shop" className={ui.cta()}>
          KEEP SHOPPING
        </Link>
      </section>
    );
  }

  const money = (m: number) => formatMoney(m, order.currency);
  const cancelled = order.status === "cancelled";
  const cod = order.payment_method === "cod";
  const paid = order.payment_status === "paid";
  const placed = !cancelled && (paid || cod);
  const pending = !cancelled && !cod && order.payment_status === "pending";
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const step = STEPS.findIndex((s) => s.key === order.status);

  const heading = cancelled
    ? "this order was cancelled"
    : order.payment_status === "refunded"
      ? "this order was refunded"
      : placed
        ? "it's yours now"
        : pending
          ? "almost there"
          : "that didn't go through";
  const sub = cancelled || order.payment_status === "failed"
    ? "you haven't been charged for this order."
    : placed
      ? `order confirmed · we're already packing it up.${cod && !paid ? ` pay ${money(order.total_minor)} in cash when it arrives.` : ""} we'll email you when it's on the way.`
      : "mobile money payments can take a minute. refresh this page shortly, we'll also email you once it's confirmed.";

  return (
    <>
      {(placed || pending) && <ClearBag />}
      {placed && returned && <Confetti onceKey={order.order_number} />}
      <section className="flex flex-col items-center gap-7 px-[22px] pt-[clamp(48px,9vw,120px)] pb-[clamp(28px,5vw,56px)] text-center">
        <Badge />
        <div>
          <h1 className="mt-0 mb-3.5 text-[clamp(36px,7vw,72px)] leading-[0.95] font-bold tracking-[-0.06em]">{heading}</h1>
          <p className="m-0 max-w-[46ch] text-[17px] leading-[1.6] text-copy">{sub}</p>
        </div>
        <dl className="m-0 flex flex-wrap justify-center gap-7 rounded-[20px] bg-ink px-[clamp(28px,4vw,40px)] py-[clamp(22px,3vw,30px)] font-mono text-bone">
          {[
            ["ORDER", order.order_number],
            ["ITEMS", String(itemCount)],
            [cod && !paid ? "TO PAY" : "PAID", money(order.total_minor)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="mb-1.5 text-[10px] font-semibold tracking-[0.2em] text-card-muted">{label}</dt>
              <dd className="m-0 text-[15px] font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <Link href="/shop" className={ui.cta()}>
          KEEP SHOPPING
        </Link>
      </section>

      <section className="mx-auto grid max-w-3xl gap-10 px-[22px] pb-[clamp(28px,5vw,72px)]" aria-label="Order details">
        {placed && (
          <ol className="m-0 grid list-none grid-cols-5 gap-1 p-0" aria-label="Order progress">
            {STEPS.map((s, i) => (
              <li key={s.key} aria-current={i === step ? "step" : undefined}>
                <span className={cn("block h-[5px] rounded-full", i <= step ? "bg-ink" : "bg-track")} />
                <span className={cn("mt-2 block font-mono text-[10px] tracking-[0.1em]", i <= step ? "text-ink" : "text-caption")}>{s.label}</span>
              </li>
            ))}
          </ol>
        )}

        <ul className="m-0 grid list-none gap-3.5 p-0">
          {order.items.map((i) => {
            const img = catalogImageUrl(i.image_path);
            return (
              <li key={i.id} className="flex items-center gap-4 rounded-[20px] border border-rule-card p-3.5">
                <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-xl">
                  {img ? <Image src={img} alt="" fill sizes="64px" className="object-cover" /> : <span className="placeholder-stripes absolute inset-0" />}
                </div>
                <div className="min-w-0 flex-1 font-mono text-xs">
                  <p className="m-0 font-semibold uppercase">{i.product_name}</p>
                  <p className="mt-1.5 mb-0 text-label">{[i.variant_title?.toLowerCase(), `qty ${i.quantity}`].filter(Boolean).join(" · ")}</p>
                </div>
                <p className="m-0 font-mono text-xs font-semibold">{money(i.line_total_minor)}</p>
              </li>
            );
          })}
        </ul>

        <div className="grid gap-8 sm:grid-cols-2">
          <dl className="m-0 grid gap-2 font-mono text-xs">
            {[
              ["subtotal", money(order.subtotal_minor)],
              ...(order.discount_minor > 0 ? [[`discount${order.discount_code ? ` (${order.discount_code})` : ""}`, `−${money(order.discount_minor)}`]] : []),
              ["delivery", order.delivery_fee_minor ? money(order.delivery_fee_minor) : "free"],
              ["total", money(order.total_minor)],
            ].map(([k, v]) => (
              <div key={k} className={cn("flex justify-between", k === "total" && "border-t border-rule pt-2 font-semibold")}>
                <dt className="text-label">{k}</dt>
                <dd className="m-0">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="font-mono text-xs leading-relaxed">
            <p className={ui.caption("mt-0 mb-2 font-semibold tracking-[0.24em]")}>DELIVERING TO</p>
            <address className="text-copy not-italic">
              {order.shipping_name}
              <br />
              {order.shipping_line1}
              {order.shipping_line2 && (
                <>
                  <br />
                  {order.shipping_line2}
                </>
              )}
              <br />
              {order.shipping_city}, {order.shipping_region}
              <br />
              {order.delivery_zone_name.toLowerCase()} · placed {formatDateTime(order.created_at).toLowerCase()}
            </address>
          </div>
        </div>
      </section>
    </>
  );
}
