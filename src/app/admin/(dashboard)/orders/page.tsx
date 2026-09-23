import Link from "next/link";
import { z } from "zod";
import { Icon } from "@/components/admin/icons";
import { PageHeader } from "@/components/admin/page-header";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/status";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form";
import { requireStaffPage } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { logError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Orders" };

const PAGE_SIZE = 40;
const VIEWS = [
  { key: "all", label: "All" },
  { key: "to-fulfil", label: "To fulfil" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "unpaid", label: "Awaiting payment" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireStaffPage();
  const sp = await searchParams;
  const view = VIEWS.some((v) => v.key === sp.status) ? (sp.status as string) : "all";
  const attention = sp.attention === "1";
  const customer = typeof sp.customer === "string" && z.uuid().safeParse(sp.customer).success ? sp.customer : null;
  // Only characters that can appear in order numbers, names, emails or phones.
  const q = typeof sp.q === "string" ? sp.q.replace(/[^\p{L}\p{N} @._+-]/gu, "").trim().slice(0, 80) : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, shipping_name, email, total_minor, currency, status, payment_status, requires_attention, created_at, order_items(quantity)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (view === "to-fulfil") query = query.eq("payment_status", "paid").in("status", ["confirmed", "processing", "ready"]);
  else if (view === "shipped") query = query.eq("status", "shipped");
  else if (view === "delivered") query = query.eq("status", "delivered");
  else if (view === "unpaid") query = query.eq("payment_status", "pending").neq("status", "cancelled");
  else if (view === "cancelled") query = query.eq("status", "cancelled");
  if (attention) query = query.eq("requires_attention", true);
  if (customer) query = query.eq("customer_id", customer);
  if (q) {
    const pattern = `"*${q}*"`;
    query = query.or(`order_number.ilike.${pattern},email.ilike.${pattern},shipping_name.ilike.${pattern},phone.ilike.${pattern}`);
  }

  const { data, count, error } = await query;
  if (error) logError("orders.list", error);
  const orders = data ?? [];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const hrefFor = (params: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const merged = { status: view, q, customer: customer ?? undefined, attention: attention ? "1" : undefined, ...params };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "all") u.set(k, String(v));
    const s = u.toString();
    return `/admin/orders${s ? `?${s}` : ""}`;
  };

  const filtered = view !== "all" || q || attention || customer;

  return (
    <>
      <PageHeader title="Orders" />

      {(attention || customer) && (
        <p className="mb-4 flex items-center justify-between gap-3 border border-line bg-paper px-4 py-2.5 text-sm">
          <span>{attention ? "Showing orders that need attention." : "Showing orders for one customer."}</span>
          <Link href="/admin/orders" className="text-muted underline underline-offset-4 hover:text-ink">
            Show all
          </Link>
        </p>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter orders" className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={hrefFor({ status: v.key, page: undefined })}
              aria-current={view === v.key ? "page" : undefined}
              className={cn(
                "h-9 shrink-0 rounded-sm px-3 text-sm leading-9",
                view === v.key ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper",
              )}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <form action="/admin/orders" className="relative lg:w-72">
          {view !== "all" && <input type="hidden" name="status" value={view} />}
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input name="q" type="search" defaultValue={q} placeholder="Order number, name, email or phone" aria-label="Search orders" className="pl-9" />
        </form>
      </div>

      {error && (
        <p role="alert" className="mb-4 border border-bad/25 bg-bad-bg px-4 py-3 text-sm text-bad">
          Orders couldn&apos;t be loaded. Refresh to try again.
        </p>
      )}

      {orders.length === 0 ? (
        <EmptyState
          title={filtered ? "No orders match." : "No orders yet."}
          description={filtered ? "Try a different filter or search." : "When customers check out, their orders will appear here."}
        />
      ) : (
        <div className="border border-line bg-paper">
          <div className="hidden grid-cols-[130px_minmax(0,1fr)_110px_220px_120px] gap-4 border-b border-line px-4 py-2 text-xs font-medium text-muted lg:grid">
            <span>Order</span>
            <span>Customer</span>
            <span className="text-right">Total</span>
            <span>Status</span>
            <span className="text-right">Date</span>
          </div>
          <ul className="divide-y divide-line">
            {orders.map((o) => {
              const items = (o.order_items ?? []).reduce((n, i) => n + i.quantity, 0);
              return (
                <li key={o.id}>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-mist lg:grid-cols-[130px_minmax(0,1fr)_110px_220px_120px] lg:items-center"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {o.requires_attention && <Icon name="alert" className="size-4 text-bad" aria-label="Needs attention" />}
                      {o.order_number}
                    </span>
                    <span className="text-right text-sm font-medium tabular lg:order-3">{formatMoney(o.total_minor, o.currency)}</span>
                    <span className="min-w-0 truncate text-sm text-ink-soft lg:order-2">
                      {o.shipping_name}
                      <span className="text-muted"> · {items} item{items === 1 ? "" : "s"}</span>
                    </span>
                    <span className="text-right text-xs text-muted lg:order-5 lg:text-sm">{formatDateTime(o.created_at)}</span>
                    <span className="col-span-2 flex flex-wrap gap-1.5 lg:order-4 lg:col-span-1">
                      <PaymentStatusBadge status={o.payment_status} />
                      <OrderStatusBadge status={o.status} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && <ButtonLink variant="secondary" size="sm" href={hrefFor({ page: page - 1 })}>Previous</ButtonLink>}
            {page < pages && <ButtonLink variant="secondary" size="sm" href={hrefFor({ page: page + 1 })}>Next</ButtonLink>}
          </div>
        </nav>
      )}
    </>
  );
}
