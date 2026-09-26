"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { ProductCard } from "@/lib/queries/catalog";
import { ProductGrid } from "./product-card";
import { ui } from "./ui";

const SORTS = [
  { key: "newest", label: "newest" },
  { key: "price_asc", label: "price ↑" },
  { key: "price_desc", label: "price ↓" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];
const PAGE_SIZE = 24;

// The sort lives in the address (?sort=…) so shared links keep it, but changing
// it never leaves the page: the grid re-orders in place, instantly.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}
function readSort(): SortKey {
  const value = new URLSearchParams(window.location.search).get("sort");
  return SORTS.some((s) => s.key === value) ? (value as SortKey) : "newest";
}

function sortProducts(products: ProductCard[], sort: SortKey): ProductCard[] {
  if (sort === "newest") return products; // already newest first from the server
  const dir = sort === "price_asc" ? 1 : -1;
  // Stable sort: equal prices keep newest-first order, as the server would.
  return [...products].sort((a, b) => dir * (a.price_min - b.price_min));
}

/**
 * The shop page body: heading and sort buttons, category links, then the grid.
 * Heading and categories are rendered on the server and passed in.
 */
export function ShopGrid({
  heading,
  categories,
  products,
  currency,
  lowStockUnder,
}: {
  heading: ReactNode;
  categories: ReactNode;
  products: ProductCard[];
  currency: string;
  lowStockUnder: number;
}) {
  const sort = useSyncExternalStore(subscribe, readSort, () => "newest" as const);
  const [shown, setShown] = useState(PAGE_SIZE);
  const sorted = useMemo(() => sortProducts(products, sort), [products, sort]);

  function choose(next: SortKey) {
    if (next === sort) return;
    const apply = () => {
      const url = new URL(window.location.href);
      if (next === "newest") url.searchParams.delete("sort");
      else url.searchParams.set("sort", next);
      window.history.replaceState(window.history.state, "", url);
      listeners.forEach((l) => l());
    };
    // Cards glide to their new places where the browser supports it.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduceMotion) document.startViewTransition(() => flushSync(apply));
    else apply();
  }

  return (
    <>
      <div className="mb-[30px] flex flex-wrap items-end justify-between gap-4">
        <div>{heading}</div>
        <div role="group" aria-label="Sort" className="flex flex-wrap gap-1.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => choose(s.key)}
              aria-pressed={sort === s.key}
              className={ui.pill(sort === s.key ? "bg-ink text-bone" : undefined)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {categories}

      {products.length > 0 && (
        <>
          <ProductGrid
            products={sorted.slice(0, shown)}
            currency={currency}
            lowStockUnder={lowStockUnder}
            numbered
            priorityCount={2}
            transitionNames
          />
          {shown < sorted.length && (
            <div className="mt-14 flex justify-center">
              <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className={ui.pill()}>
                show more ({sorted.length - shown})
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
