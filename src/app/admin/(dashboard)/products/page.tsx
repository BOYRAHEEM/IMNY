import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/admin/icons";
import { PageHeader, filterTab } from "@/components/admin/page-header";
import { ProductStatusBadge } from "@/components/admin/status";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form";
import { requireStaffPage } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { logError } from "@/lib/errors";
import { catalogImageUrl } from "@/lib/images";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Products" };

const PAGE_SIZE = 40;
const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
] as const;

/** Escape LIKE wildcards so a search for "50%" matches literally. */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireStaffPage();
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? (sp.status as string) : "all";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(
      "id, name, status, featured, updated_at, category:categories(name), " +
        "images:product_images(storage_path, is_primary), " +
        "variants:product_variants(price_minor, is_active, inventory(on_hand, reserved))",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status === "all") query = query.neq("status", "archived");
  else query = query.eq("status", status as "active" | "draft" | "archived");
  if (q) query = query.ilike("name", likePattern(q));

  const [{ data, count, error }, { data: settings }] = await Promise.all([
    query,
    supabase.from("store_settings").select("currency").single(),
  ]);
  if (error) logError("products.list", error);
  const currency = settings?.currency ?? "GHS";

  type Row = {
    id: string;
    name: string;
    status: string;
    featured: boolean;
    category: { name: string } | null;
    images: { storage_path: string; is_primary: boolean }[];
    variants: { price_minor: number; is_active: boolean; inventory: { on_hand: number; reserved: number } | null }[];
  };
  const rows = ((data ?? []) as unknown as Row[]).map((p) => {
    const active = p.variants.filter((v) => v.is_active);
    const prices = active.map((v) => v.price_minor);
    const stock = active.reduce((sum, v) => sum + Math.max(0, (v.inventory?.on_hand ?? 0) - (v.inventory?.reserved ?? 0)), 0);
    const image = p.images.find((i) => i.is_primary) ?? p.images[0];
    return {
      ...p,
      image: catalogImageUrl(image?.storage_path),
      price:
        prices.length === 0
          ? "No price"
          : Math.min(...prices) === Math.max(...prices)
            ? formatMoney(prices[0], currency)
            : `${formatMoney(Math.min(...prices), currency)} – ${formatMoney(Math.max(...prices), currency)}`,
      stock,
      variantCount: active.length,
    };
  });

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hrefFor = (params: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const merged = { status, q, page: undefined as number | undefined, ...params };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "all") u.set(k, String(v));
    const s = u.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Products"
        actions={
          <ButtonLink href="/admin/products/new">
            <Icon name="plus" className="size-4" /> Add product
          </ButtonLink>
        }
      />

      {sp.deleted === "1" && (
        <p role="status" className="mb-4 rounded-2xl border border-good/25 bg-good-bg px-4 py-3 text-sm text-good">
          Product deleted.
        </p>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter by status" className="-mx-1 flex gap-1.5 overflow-x-auto no-scrollbar px-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={hrefFor({ status: t.key })}
              aria-current={status === t.key ? "page" : undefined}
              className={filterTab(status === t.key)}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <form action="/admin/products" className="relative sm:w-72">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input name="q" type="search" defaultValue={q} placeholder="Search products" aria-label="Search products" className="pl-9" />
        </form>
      </div>

      {rows.length === 0 ? (
        q || status !== "all" ? (
          <EmptyState title="No products match." description="Try a different search or filter." />
        ) : (
          <EmptyState
            title="No products yet."
            description="Add your first product with photos, sizes, colours and prices."
            action={<ButtonLink href="/admin/products/new">Add your first product</ButtonLink>}
          />
        )
      ) : (
        <div className="overflow-hidden rounded-3xl border border-line bg-paper">
          <ul className="divide-y divide-line">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/products/${p.id}`} className="flex items-center gap-4 px-3 py-3 hover:bg-mist sm:px-4">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl placeholder-stripes sm:size-16">
                    {p.image ? (
                      <Image src={p.image} alt="" fill sizes="64px" className="object-cover" />
                    ) : (
                      <Icon name="image" className="absolute inset-0 m-auto size-6 text-faint" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {p.price}
                      {p.category && <span> · {p.category.name}</span>}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
                      <ProductStatusBadge status={p.status} />
                      <StockText stock={p.stock} variants={p.variantCount} />
                    </div>
                  </div>
                  <div className="hidden w-36 sm:block">
                    <StockText stock={p.stock} variants={p.variantCount} />
                  </div>
                  <div className="hidden w-24 text-right sm:block">
                    <ProductStatusBadge status={p.status} />
                    {p.featured && <p className="mt-1 text-xs text-muted">Featured</p>}
                  </div>
                </Link>
              </li>
            ))}
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

function StockText({ stock, variants }: { stock: number; variants: number }) {
  if (variants === 0) return <span className="text-sm text-muted">No variants</span>;
  return (
    <span className={cn("text-sm tabular", stock === 0 ? "text-bad" : "text-ink-soft")}>
      {stock === 0 ? "Out of stock" : `${stock} in stock`}
      {variants > 1 && <span className="text-muted"> · {variants} variants</span>}
    </span>
  );
}
