import Link from "next/link";
import { Icon } from "@/components/admin/icons";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form";
import { requireStaffPage } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Customers" };

const PAGE_SIZE = 50;

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireStaffPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  const [{ data, error }, { data: settings }] = await Promise.all([
    supabase.rpc("admin_customers", { p_search: q || undefined, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    supabase.from("store_settings").select("currency").single(),
  ]);
  if (error) logError("customers.list", error);
  const currency = settings?.currency ?? "GHS";
  const rows = data ?? [];
  const total = Number(rows[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Customers" description="Everyone who has ordered or created an account." />

      <form action="/admin/customers" className="relative mb-4 sm:w-80">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
        <Input name="q" type="search" defaultValue={q} placeholder="Name, email or phone" aria-label="Search customers" className="pl-9" />
      </form>

      {error && (
        <p role="alert" className="mb-4 border border-bad/25 bg-bad-bg px-4 py-3 text-sm text-bad">
          Customers couldn&apos;t be loaded. Refresh to try again.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title={q ? "No customers match that search." : "No customers yet."}
          description={q ? undefined : "Customers appear here after their first order or sign-up."}
        />
      ) : (
        <div className="border border-line bg-paper">
          <div className="hidden grid-cols-[minmax(0,1fr)_90px_130px_120px] gap-4 border-b border-line px-4 py-2 text-xs font-medium text-muted md:grid">
            <span>Customer</span>
            <span className="text-right">Orders</span>
            <span className="text-right">Total spent</span>
            <span className="text-right">Last order</span>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((c) => {
              const body = (
                <>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {c.full_name || c.email}
                      {c.has_account && <Badge>Account</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {c.full_name ? c.email : ""}
                      {c.phone && `${c.full_name ? " · " : ""}${c.phone}`}
                    </p>
                  </div>
                  <p className="text-right text-sm tabular">
                    {Number(c.order_count)} <span className="text-muted md:hidden">orders</span>
                  </p>
                  <p className="hidden text-right text-sm tabular md:block">{formatMoney(Number(c.total_spent_minor), currency)}</p>
                  <p className="hidden text-right text-sm text-muted md:block">{formatDate(c.last_order_at)}</p>
                </>
              );
              const cls = "grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 md:grid-cols-[minmax(0,1fr)_90px_130px_120px]";
              return (
                <li key={c.customer_id ?? c.user_id ?? c.email}>
                  {c.customer_id ? (
                    <Link href={`/admin/orders?customer=${c.customer_id}`} className={`${cls} hover:bg-mist`}>
                      {body}
                    </Link>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
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
            {page > 1 && <ButtonLink variant="secondary" size="sm" href={pageHref(page - 1)}>Previous</ButtonLink>}
            {page < pages && <ButtonLink variant="secondary" size="sm" href={pageHref(page + 1)}>Next</ButtonLink>}
          </div>
        </nav>
      )}
    </>
  );
}
