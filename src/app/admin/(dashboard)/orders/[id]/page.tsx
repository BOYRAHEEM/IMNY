import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Icon } from "@/components/admin/icons";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { OrderStatusBadge, orderStatusLabel, PaymentStatusBadge } from "@/components/admin/status";
import { requireStaffPage } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { catalogImageUrl } from "@/lib/images";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { CashPaymentForm, NoteForm, RefundForm, ResolveForm, StatusPanel } from "./order-actions";

export const metadata = { title: "Order" };

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const user = await requireStaffPage();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [orderRes, historyRes, notesRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "*, items:order_items(id, product_id, product_name, variant_title, sku, image_path, unit_price_minor, quantity, line_total_minor)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("order_status_history").select("id, to_status, to_payment_status, from_status, from_payment_status, created_at").eq("order_id", id).order("created_at"),
    supabase.from("order_notes").select("id, body, created_at, author:profiles(full_name, email)").eq("order_id", id).order("created_at"),
  ]);
  if (orderRes.error) logError("order.get", orderRes.error);
  const order = orderRes.data;
  if (!order) notFound();

  const history = historyRes.data ?? [];
  const notes = notesRes.data ?? [];
  const money = (m: number) => formatMoney(m, order.currency);
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <>
      <PageHeader
        title={`Order ${order.order_number}`}
        description={`Placed ${formatDateTime(order.created_at)}`}
        back={{ href: "/admin/orders", label: "Orders" }}
        actions={
          <div className="flex flex-wrap gap-1.5">
            <PaymentStatusBadge status={order.payment_status} method={order.payment_method} />
            <OrderStatusBadge status={order.status} />
          </div>
        }
      />

      {order.requires_attention && (
        <div role="alert" className="mb-6 rounded-2xl border border-bad/25 bg-bad-bg px-4 py-3 text-sm text-bad">
          <p className="flex items-start gap-2">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong className="font-semibold">Needs attention:</strong> {order.attention_reason ?? "Check this order."}
            </span>
          </p>
          <ResolveForm orderId={order.id} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Panel title={`Items (${itemCount})`}>
            <ul className="divide-y divide-line">
              {order.items.map((item) => {
                const img = catalogImageUrl(item.image_path);
                return (
                  <li key={item.id} className="flex gap-3 px-4 py-3 sm:px-5">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-xl placeholder-stripes">
                      {img && <Image src={img} alt="" fill sizes="64px" className="object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      {item.product_id ? (
                        <Link href={`/admin/products/${item.product_id}`} className="text-sm font-medium hover:underline">
                          {item.product_name}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium">{item.product_name}</p>
                      )}
                      {item.variant_title && <p className="text-sm text-ink-soft">{item.variant_title}</p>}
                      {item.sku && <p className="text-xs text-muted">SKU {item.sku}</p>}
                    </div>
                    <div className="text-right text-sm">
                      <p className="tabular">
                        {money(item.unit_price_minor)} × {item.quantity}
                      </p>
                      <p className="mt-0.5 font-medium tabular">{money(item.line_total_minor)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <dl className="space-y-1.5 border-t border-line px-4 py-4 text-sm sm:px-5">
              <Row label="Subtotal" value={money(order.subtotal_minor)} />
              {order.discount_minor > 0 && (
                <Row label={`Discount${order.discount_code ? ` (${order.discount_code})` : ""}`} value={`−${money(order.discount_minor)}`} />
              )}
              <Row label={`Delivery · ${order.delivery_zone_name}`} value={order.delivery_fee_minor ? money(order.delivery_fee_minor) : "Free"} />
              <Row label="Total" value={money(order.total_minor)} strong />
            </dl>
            <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">
              Prices shown are what the customer paid at the time of purchase.
            </p>
          </Panel>

          <Panel title="Timeline">
            <ol className="space-y-3 px-4 py-4 sm:px-5">
              {history.map((h) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink" />
                  <span className="flex-1">
                    {h.from_status === null
                      ? "Order placed"
                      : h.to_payment_status !== h.from_payment_status
                        ? `Payment ${h.to_payment_status === "paid" ? "received" : h.to_payment_status}${h.to_status !== h.from_status ? ` · ${orderStatusLabel(h.to_status)}` : ""}`
                        : orderStatusLabel(h.to_status)}
                  </span>
                  <span className="text-muted">{formatDateTime(h.created_at)}</span>
                </li>
              ))}
            </ol>
            <div className="border-t border-line px-4 py-4 sm:px-5">
              <h3 className="mb-3 text-sm font-semibold">Internal notes</h3>
              {notes.length > 0 && (
                <ul className="mb-4 space-y-3">
                  {notes.map((n) => {
                    const author = n.author as unknown as { full_name: string | null; email: string } | null;
                    return (
                      <li key={n.id} className="border-l-2 border-line pl-3 text-sm">
                        <p className="whitespace-pre-line">{n.body}</p>
                        <p className="mt-1 text-xs text-muted">
                          {author?.full_name || author?.email || "System"} · {formatDateTime(n.created_at)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
              <NoteForm orderId={order.id} />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Fulfilment">
            <StatusPanel
              orderId={order.id}
              status={order.status}
              paymentStatus={order.payment_status}
              paymentMethod={order.payment_method}
              stockCommitted={order.stock_state === "committed"}
            />
          </Panel>

          <Panel title="Customer">
            <div className="space-y-1 p-4 text-sm sm:p-5">
              <p className="font-medium">{order.shipping_name}</p>
              <p>
                <a href={`mailto:${order.email}`} className="break-all underline underline-offset-4">
                  {order.email}
                </a>
              </p>
              <p>
                <a href={`tel:${order.phone}`} className="underline underline-offset-4">
                  {order.phone}
                </a>
              </p>
              <p className="pt-2">
                <Link href={`/admin/orders?customer=${order.customer_id}`} className="text-muted hover:text-ink">
                  Other orders from this customer
                </Link>
              </p>
            </div>
          </Panel>

          <Panel title="Delivery">
            <address className="space-y-0.5 p-4 text-sm not-italic sm:p-5">
              <p>{order.shipping_line1}</p>
              {order.shipping_line2 && <p>{order.shipping_line2}</p>}
              <p>
                {order.shipping_city}, {order.shipping_region}
              </p>
              {order.shipping_digital_address && <p>GhanaPost GPS: {order.shipping_digital_address}</p>}
              <p className="pt-2 text-muted">{order.delivery_zone_name}</p>
              {order.delivery_instructions && (
                <p className="mt-2 border-l-2 border-line pl-3 whitespace-pre-line">{order.delivery_instructions}</p>
              )}
            </address>
          </Panel>

          <Panel title="Payment">
            <dl className="space-y-1.5 p-4 text-sm sm:p-5">
              <Row label="Status" value={<PaymentStatusBadge status={order.payment_status} method={order.payment_method} />} />
              <Row label="Method" value={order.payment_method === "cod" ? "Cash on delivery" : <span className="capitalize">{order.payment_provider}</span>} />
              <Row label="Reference" value={<span className="font-mono text-xs break-all">{order.payment_reference}</span>} />
              {order.paid_at && <Row label="Paid" value={formatDateTime(order.paid_at)} />}
              {order.cancel_reason && <Row label="Cancelled" value={order.cancel_reason} />}
            </dl>
            {order.payment_method === "cod" && order.payment_status === "pending" && order.status !== "cancelled" && (
              <div className="border-t border-line p-4 sm:p-5">
                <CashPaymentForm orderId={order.id} amount={money(order.total_minor)} />
              </div>
            )}
            {user.role === "admin" && order.payment_status === "paid" && (
              <div className="border-t border-line p-4 sm:p-5">
                <RefundForm orderId={order.id} />
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-line pt-2 text-base font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className="text-right tabular">{value}</dd>
    </div>
  );
}
