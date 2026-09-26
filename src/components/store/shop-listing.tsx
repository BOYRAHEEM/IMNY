import Link from "next/link";
import { ProductGrid } from "@/components/store/product-card";
import { cn } from "@/lib/cn";
import { getCategories, listProducts, safely, type Category } from "@/lib/queries/catalog";
import { getStoreSettings } from "@/lib/queries/settings";
import { ui } from "./ui";

const PAGE_SIZE = 24;
const SORTS = [
  { key: "newest", label: "newest" },
  { key: "price_asc", label: "price ↑" },
  { key: "price_desc", label: "price ↓" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

export async function ShopListing({
  category,
  searchParams,
}: {
  category: Category | null;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const sort: SortKey = SORTS.some((s) => s.key === searchParams.sort) ? (searchParams.sort as SortKey) : "newest";
  const page = Math.min(100, Math.max(1, Number(searchParams.page) || 1));
  const basePath = category ? `/shop/${category.slug}` : "/shop";

  const [settings, categories, result] = await Promise.all([
    getStoreSettings(),
    safely("shop.categories", getCategories, []),
    safely("shop.products", () => listProducts({ categoryId: category?.id, sort, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }), null),
  ]);

  const topLevel = categories.filter((c) => !c.parent_id);
  const children = category ? categories.filter((c) => c.parent_id === (category.parent_id ?? category.id)) : [];
  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / PAGE_SIZE));
  const href = (params: { sort?: string; page?: number }) => {
    const q = new URLSearchParams();
    const s = params.sort ?? sort;
    if (s !== "newest") q.set("sort", s);
    if (params.page && params.page > 1) q.set("page", String(params.page));
    const qs = q.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  return (
    <section className={ui.section()}>
      <div className="mb-[30px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={ui.h1()}>{category ? category.name.toLowerCase() : settings.content.shop_heading}</h1>
          {category?.description && <p className="mt-4 mb-0 max-w-[56ch] text-[17px] leading-normal text-copy">{category.description}</p>}
        </div>
        <nav aria-label="Sort" className="flex flex-wrap gap-1.5">
          {SORTS.map((s) => (
            <Link key={s.key} href={href({ sort: s.key })} aria-current={sort === s.key ? "true" : undefined} className={ui.pill(sort === s.key ? "bg-ink text-bone" : undefined)}>
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      {topLevel.length > 0 && (
        <nav aria-label="Categories" className="no-scrollbar -mx-[22px] mb-[30px] overflow-x-auto px-[22px]">
          <ul className="flex gap-1.5">
            <li>
              <Link href="/shop" className={ui.pill(cn(!category && "bg-ink text-bone"))}>
                all
              </Link>
            </li>
            {topLevel.map((c) => {
              const active = category?.id === c.id || category?.parent_id === c.id;
              return (
                <li key={c.id}>
                  <Link href={`/shop/${c.slug}`} className={ui.pill(cn(active && "bg-ink text-bone"))}>
                    {c.name.toLowerCase()}
                  </Link>
                </li>
              );
            })}
          </ul>
          {children.length > 0 && (
            <ul className="mt-2 flex gap-1.5">
              {children.map((c) => (
                <li key={c.id}>
                  <Link href={`/shop/${c.slug}`} className={ui.pill(cn("border-rule", category?.id === c.id && "bg-ink text-bone"))}>
                    {c.name.toLowerCase()}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
      )}

      {!result ? (
        <p role="alert" className="py-20 font-mono text-xs tracking-[0.1em] text-label">
          something went wrong loading the shop. refresh to try again.
        </p>
      ) : result.products.length === 0 ? (
        <div className="flex flex-col items-start gap-[18px] py-[clamp(32px,6vw,72px)]">
          <p className="m-0 text-[clamp(20px,3vw,30px)] font-bold tracking-[-0.03em] text-copy">nothing in here yet.</p>
          {category && (
            <Link href="/shop" className={ui.cta()}>
              SEE EVERYTHING
            </Link>
          )}
        </div>
      ) : (
        <>
          <ProductGrid products={result.products} currency={settings.currency} lowStockUnder={settings.low_stock_badge_threshold} numbered priorityCount={2} />
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-14 flex items-center justify-center gap-3">
              {page > 1 && (
                <Link href={href({ page: page - 1 })} className={ui.pill()}>
                  ← prev
                </Link>
              )}
              <span className={ui.caption()}>
                {page} / {pages}
              </span>
              {page < pages && (
                <Link href={href({ page: page + 1 })} className={ui.pill()}>
                  next →
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
