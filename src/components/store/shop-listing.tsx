import Link from "next/link";
import { cn } from "@/lib/cn";
import { getCategories, listAllProducts, safely, type Category } from "@/lib/queries/catalog";
import { getStoreSettings } from "@/lib/queries/settings";
import { ShopGrid } from "./shop-grid";
import { ui } from "./ui";

export async function findCategory(slug: string): Promise<Category | null> {
  const categories = await safely("category.lookup", getCategories, []);
  return categories.find((c) => c.slug === slug) ?? null;
}

/**
 * The shop page. The whole range is loaded here (and prebuilt/cached), and
 * sorting and "show more" happen on the device, so they're instant and never
 * wait on the server.
 */
export async function ShopListing({ category }: { category: Category | null }) {
  const [settings, categories, products] = await Promise.all([
    getStoreSettings(),
    safely("shop.categories", getCategories, []),
    safely("shop.products", () => listAllProducts(category?.id), null),
  ]);

  const topLevel = categories.filter((c) => !c.parent_id);
  const children = category ? categories.filter((c) => c.parent_id === (category.parent_id ?? category.id)) : [];

  const heading = (
    <>
      <h1 className={ui.h1()}>{category ? category.name.toLowerCase() : settings.content.shop_heading}</h1>
      {category?.description && <p className="mt-4 mb-0 max-w-[56ch] text-[17px] leading-normal text-copy">{category.description}</p>}
    </>
  );

  const categoryNav = topLevel.length > 0 && (
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
  );

  return (
    <section className={ui.section()}>
      <ShopGrid
        heading={heading}
        categories={categoryNav}
        products={products ?? []}
        currency={settings.currency}
        lowStockUnder={settings.low_stock_badge_threshold}
      />
      {!products ? (
        <p role="alert" className="py-20 font-mono text-xs tracking-[0.1em] text-label">
          something went wrong loading the shop. refresh to try again.
        </p>
      ) : (
        products.length === 0 && (
          <div className="flex flex-col items-start gap-[18px] py-[clamp(32px,6vw,72px)]">
            <p className="m-0 text-[clamp(20px,3vw,30px)] font-bold tracking-[-0.03em] text-copy">nothing in here yet.</p>
            {category && (
              <Link href="/shop" className={ui.cta()}>
                SEE EVERYTHING
              </Link>
            )}
          </div>
        )
      )}
    </section>
  );
}
