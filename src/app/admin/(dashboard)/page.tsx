import Link from "next/link";
import { Icon } from "@/components/admin/icons";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/status";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { requireStaffPage } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { formatCount, formatDateTime } from "@/lib/format";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

type Stats = {
  currency: string;
  total_orders: number;
  revenue_minor: number;
  revenue_30d_minor: number;
  orders_30d: number;
  pending_orders: number;
  attention_orders: number;
  active_products: number;
  draft_products: number;
  low_stock_variants: number;
};

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireStaffPage();
  const { error: notice } = await searchParams;
  const supabase = await createClient();

  const [statsRes, recentRes, lowRes, settingsRes] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase
      .from("orders")
      .select("id, order_number, shipping_name, total_minor, currency, status, payment_status, payment_method, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.rpc("admin_low_stock", { p_limit: 8 }),
    supabase.from("store_settings").select("social_links").single(),
  ]);

  // The footer always shows Instagram and TikTok buttons; remind the team to link them.
  const social = (settingsRes.data?.social_links ?? {}) as Record<string, string>;
  const missingSocial = (["Instagram", "TikTok"] as const).filter((n) => !social[n.toLowerCase()]?.startsWith("https://"));

  if (statsRes.error) logError("dashboard.stats", statsRes.error);
  if (recentRes.error) logError("dashboard.recent", recentRes.error);
  if (lowRes.error) logError("dashboard.lowStock", lowRes.error);

  const stats = (statsRes.data ?? null) as Stats | null;
  const currency = stats?.currency ?? "GHS";
  const recent = recentRes.data ?? [];
  const lowStock = lowRes.data ?? [];

  const firstName = user.fullName?.split(" ")[0];

  return (
    <>
      <PageHeader title={firstName ? `Hello, ${firstName}` : "Dashboard"} description="Here's how the store is doing." />

      {notice === "admin-only" && (
        <p role="alert" className="mb-6 rounded-2xl border border-warn/25 bg-warn-bg px-4 py-3 text-sm text-warn">
          That page is only available to admins.
        </p>
      )}

      {missingSocial.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn/25 bg-warn-bg px-4 py-3 text-sm text-warn">
          <p className="flex items-center gap-2">
            <Icon name="alert" className="size-4 shrink-0" />
            Add your {missingSocial.join(" and ")} link{missingSocial.length > 1 ? "s" : ""}. The footer buttons don&apos;t go anywhere until you do.
          </p>
          {user.role === "admin" && (
            <ButtonLink href="/admin/settings#s-instagram" variant="secondary" size="sm">
              Add links
            </ButtonLink>
          )}
        </div>
      )}

      {!stats && (
        <p role="alert" className="mb-6 rounded-2xl border border-bad/25 bg-bad-bg px-4 py-3 text-sm text-bad">
          Some figures couldn&apos;t be loaded. Refresh to try again.
        </p>
      )}

      {stats && stats.attention_orders > 0 && (
        <Link
          href="/admin/orders?attention=1"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-bad/25 bg-bad-bg px-4 py-3 text-sm text-bad hover:underline"
        >
          <Icon name="alert" className="size-5 shrink-0" />
          <span>
            <strong className="font-semibold">{stats.attention_orders}</strong>{" "}
            {stats.attention_orders === 1 ? "order needs" : "orders need"} your attention (for example a refund).
          </span>
        </Link>
      )}

      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
          <StatTile label="Revenue, last 30 days" value={formatMoneyCompact(stats.revenue_30d_minor, currency)} highlight />
          <StatTile label="Paid orders, last 30 days" value={formatCount(stats.orders_30d)} />
          <StatTile label="To fulfil" value={formatCount(stats.pending_orders)} href="/admin/orders?status=to-fulfil" />
          <StatTile
            label="Low-stock variants"
            value={formatCount(stats.low_stock_variants)}
            href="/admin/inventory?filter=low"
            warn={stats.low_stock_variants > 0}
          />
          <StatTile
            label="Published products"
            value={formatCount(stats.active_products)}
            sub={stats.draft_products ? `${stats.draft_products} draft` : undefined}
            href="/admin/products"
            className="col-span-2 lg:col-span-1"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Panel
          title="Recent orders"
          action={
            <Link href="/admin/orders" className="text-sm text-muted hover:text-ink">
              View all
            </Link>
          }
        >
          {recent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No orders yet. They&apos;ll appear here as they come in.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-mist sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {o.order_number} <span className="font-normal text-muted">· {o.shipping_name}</span>
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <PaymentStatusBadge status={o.payment_status} method={o.payment_method} />
                        <OrderStatusBadge status={o.status} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular">{formatMoney(o.total_minor, o.currency)}</p>
                      <p className="mt-1 text-xs text-muted">{formatDateTime(o.created_at)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Low stock"
          action={
            <Link href="/admin/inventory?filter=low" className="text-sm text-muted hover:text-ink">
              Inventory
            </Link>
          }
        >
          {lowStock.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Everything is well stocked.</p>
          ) : (
            <ul className="divide-y divide-line">
              {lowStock.map((v) => (
                <li key={v.variant_id}>
                  <Link href={`/admin/products/${v.product_id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-mist sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{v.product_name}</p>
                      {v.variant_title && <p className="truncate text-xs text-muted">{v.variant_title}</p>}
                    </div>
                    <span className={`shrink-0 text-sm tabular ${v.available <= 0 ? "text-bad" : "text-warn"}`}>
                      {v.available <= 0 ? "Sold out" : `${v.available} left`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {stats && stats.active_products === 0 && (
        <div className="mt-8 rounded-2xl border border-line bg-paper px-5 py-8 text-center">
          <p className="font-medium">Your store has no published products yet.</p>
          <p className="mt-1 text-sm text-muted">Add a product with photos, sizes and prices to start selling.</p>
          <ButtonLink href="/admin/products/new" className="mt-5">
            Add your first product
          </ButtonLink>
        </div>
      )}
    </>
  );
}

function StatTile({
  label,
  value,
  sub,
  href,
  warn,
  highlight,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  warn?: boolean;
  /** Lime tile, like the store's accent pills. */
  highlight?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <p className={cn("flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] uppercase", highlight ? "text-ink/70" : "text-caption")}>
        {warn && <Icon name="alert" className="size-3.5 text-warn" />}
        {label}
      </p>
      <p className="mt-3 text-[clamp(26px,3vw,34px)] leading-none font-bold tracking-[-0.05em] tabular">{value}</p>
      {sub && <p className="mt-1.5 font-mono text-[11px] text-muted">{sub}</p>}
    </>
  );
  return (
    <div className={cn("overflow-hidden rounded-3xl border", highlight ? "border-lime bg-lime" : "border-line bg-paper", className)}>
      {href ? (
        <Link href={href} className="block h-full p-4 transition-colors hover:bg-mist sm:p-5">
          {body}
        </Link>
      ) : (
        <div className="p-4 sm:p-5">{body}</div>
      )}
    </div>
  );
}
