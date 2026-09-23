import Link from "next/link";
import { ProductGrid } from "@/components/store/product-card";
import { cn } from "@/lib/cn";
import { getCategories, listProducts, safely, type Category } from "@/lib/queries/catalog";
import { getStoreSettings } from "@/lib/queries/settings";

const PAGE_SIZE = 24;
const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
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
    safely(
      "shop.products",
      () => listProducts({ categoryId: category?.id, sort, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
      null,
    ),
  ]);

  const parentId = category?.parent_id ?? category?.id;
  const chips = categories.filter((c) => (parentId ? c.parent_id === parentId || c.id === parentId : !c.parent_id));
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
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-10">
      <header className="mb-8">
        <h1 className="font-display text-4xl sm:text-5xl">{category?.name ?? "Shop all"}</h1>
        {category?.description && <p className="mt-3 max-w-2xl text-ink-soft">{category.description}</p>}
      </header>

      <div className="mb-8 flex flex-col gap-4 border-y border-line py-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-5 text-sm whitespace-nowrap">
            <li>
              <Link
                href={parentId ? `/shop/${categories.find((c) => c.id === parentId)?.slug ?? ""}` : "/shop"}
                className={cn("py-1", (!category || category.id === parentId) && "underline underline-offset-4")}
              >
                All
              </Link>
            </li>
            {chips
              .filter((c) => c.id !== parentId)
              .map((c) => (
                <li key={c.id}>
                  <Link href={`/shop/${c.slug}`} className={cn("py-1 text-ink-soft hover:text-ink", category?.id === c.id && "text-ink underline underline-offset-4")}>
                    {c.name}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
        <nav aria-label="Sort" className="flex items-center gap-4 text-sm">
          <span className="text-muted">Sort</span>
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={href({ sort: s.key })}
              aria-current={sort === s.key ? "true" : undefined}
              className={cn("whitespace-nowrap", sort === s.key ? "underline underline-offset-4" : "text-ink-soft hover:text-ink")}
            >
              {s.key === "newest" ? "Newest" : s.key === "price_asc" ? "Price ↑" : "Price ↓"}
            </Link>
          ))}
        </nav>
      </div>

      {!result ? (
        <p role="alert" className="py-24 text-center text-muted">
          Something went wrong loading products. Please refresh the page.
        </p>
      ) : result.products.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-display text-2xl">Nothing here yet.</p>
          <p className="mt-2 text-sm text-muted">New pieces are on their way.</p>
          {category && (
            <Link href="/shop" className="mt-6 inline-block text-sm underline underline-offset-4">
              Browse everything
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="mb-6 text-sm text-muted">
            {result.total} {result.total === 1 ? "piece" : "pieces"}
          </p>
          <ProductGrid products={result.products} currency={settings.currency} priorityCount={4} />
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-14 flex items-center justify-center gap-6 text-sm">
              {page > 1 ? <Link href={href({ page: page - 1 })} className="underline underline-offset-4">Previous</Link> : <span />}
              <span className="text-muted">
                Page {page} of {pages}
              </span>
              {page < pages ? <Link href={href({ page: page + 1 })} className="underline underline-offset-4">Next</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
