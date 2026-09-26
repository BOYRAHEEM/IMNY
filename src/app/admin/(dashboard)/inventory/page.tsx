import Link from "next/link";
import { Icon } from "@/components/admin/icons";
import { PageHeader, filterTab } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form";
import { requireStaffPage } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { StockRow, type StockRowData } from "./stock-row";

export const metadata = { title: "Inventory" };

const PAGE_SIZE = 50;
const FILTERS = [
  { key: "all", label: "All" },
  { key: "low", label: "Low stock" },
  { key: "out", label: "Sold out" },
] as const;

/** Consecutive rows of the same product, so its name is shown once. */
function groupByProduct(rows: StockRowData[]) {
  const groups: { product_id: string; product_name: string; product_status: string; rows: StockRowData[] }[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last?.product_id === row.product_id) last.rows.push(row);
    else groups.push({ product_id: row.product_id, product_name: row.product_name, product_status: row.product_status, rows: [row] });
  }
  return groups;
}

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  await requireStaffPage();
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.key === sp.filter) ? (sp.filter as string) : "all";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_inventory", {
    p_search: q || undefined,
    p_filter: filter,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) logError("inventory.list", error);

  const rows = (data ?? []) as StockRowData[];
  const total = Number((data as { total_count?: number }[] | null)?.[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hrefFor = (params: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ filter, q, ...params })) if (v && v !== "all") u.set(k, String(v));
    const s = u.toString();
    return `/admin/inventory${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Inventory" description="Stock for every size and colour. Held units are reserved for customers who are paying." />

      {error && (
        <p role="alert" className="mb-4 rounded-2xl border border-bad/25 bg-bad-bg px-4 py-3 text-sm text-bad">
          Inventory couldn&apos;t be loaded. Refresh to try again.
        </p>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter stock" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={hrefFor({ filter: f.key, page: undefined })}
              aria-current={filter === f.key ? "page" : undefined}
              className={filterTab(filter === f.key)}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <form action="/admin/inventory" className="relative sm:w-72">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input name="q" type="search" defaultValue={q} placeholder="Search by product or SKU" aria-label="Search inventory" className="pl-9" />
        </form>
      </div>

      {rows.length === 0 ? (
        q || filter !== "all" ? (
          <EmptyState
            title={filter === "all" ? "Nothing matches that search." : filter === "low" ? "Nothing is running low." : "Nothing is sold out."}
          />
        ) : (
          <EmptyState
            title="No stock to track yet."
            description="Stock appears here once you add products."
            action={<ButtonLink href="/admin/products/new">Add a product</ButtonLink>}
          />
        )
      ) : (
        <div className="overflow-hidden rounded-3xl border border-line bg-paper">
          <div className="hidden grid-cols-[minmax(0,1fr)_90px_90px_220px] gap-x-4 border-b border-line px-4 py-2 text-xs font-medium text-muted md:grid">
            <span>Size / colour</span>
            <span>Available</span>
            <span>Held</span>
            <span>On hand</span>
          </div>
          {groupByProduct(rows).map((group) => (
            <section key={group.product_id} aria-label={group.product_name} className="border-b border-line last:border-b-0">
              <div className="flex items-center justify-between gap-3 bg-mist/60 px-4 py-2.5">
                <Link href={`/admin/products/${group.product_id}`} className="truncate text-sm font-semibold hover:underline">
                  {group.product_name}
                </Link>
                {group.product_status === "draft" && <Badge>Draft</Badge>}
              </div>
              <ul className="divide-y divide-line">
                {group.rows.map((row) => (
                  <StockRow key={`${row.variant_id}-${row.on_hand}`} row={row} />
                ))}
              </ul>
            </section>
          ))}
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
