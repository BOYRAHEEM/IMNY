import Image from "next/image";
import Link from "next/link";
import { ProductGrid } from "@/components/store/product-card";
import { buttonClasses } from "@/components/ui/button";
import { catalogImageUrl } from "@/lib/images";
import { getCategories, listProducts, safely } from "@/lib/queries/catalog";
import { getStoreSettings } from "@/lib/queries/settings";

export const revalidate = 300;

export default async function HomePage() {
  const empty = { products: [], total: 0 };
  const [settings, newest, featured, categories] = await Promise.all([
    getStoreSettings(),
    safely("home.newest", () => listProducts({ sort: "newest", limit: 8 }), empty),
    safely("home.featured", () => listProducts({ featured: true, limit: 8 }), empty),
    safely("home.categories", getCategories, []),
  ]);

  const hero = featured.products.find((p) => p.image_path) ?? newest.products.find((p) => p.image_path);
  const heroImage = catalogImageUrl(hero?.image_path);
  const topCategories = categories.filter((c) => !c.parent_id);

  if (newest.total === 0) {
    return (
      <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-32 text-center">
        <h1 className="font-display text-5xl">{settings.store_name}</h1>
        <p className="mt-4 text-muted">{settings.tagline ?? "Our first collection is on its way."}</p>
      </section>
    );
  }

  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 pt-6 sm:px-6 md:grid-cols-2 md:gap-12 md:pt-10 lg:px-10">
        <div className="order-2 md:order-1 md:py-16">
          <p className="mb-4 text-xs tracking-[0.25em] text-muted uppercase">New collection</p>
          <h1 className="font-display text-5xl leading-[1.02] font-medium sm:text-6xl lg:text-7xl">
            {settings.tagline ?? settings.store_name}
          </h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/shop" className={buttonClasses("primary", "md", "px-8 tracking-wide uppercase")}>
              Shop now
            </Link>
            {hero && (
              <Link href={`/product/${hero.slug}`} className={buttonClasses("ghost", "md", "tracking-wide underline underline-offset-4")}>
                {hero.name}
              </Link>
            )}
          </div>
        </div>
        {heroImage && hero && (
          <Link href={`/product/${hero.slug}`} className="relative order-1 block aspect-[4/5] overflow-hidden bg-mist md:order-2">
            <Image
              src={heroImage}
              alt={hero.image_alt || hero.name}
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </Link>
        )}
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-10" aria-labelledby="new-in">
        <div className="mb-8 flex items-end justify-between">
          <h2 id="new-in" className="font-display text-3xl sm:text-4xl">
            New in
          </h2>
          <Link href="/shop" className="text-sm underline underline-offset-4">
            View all
          </Link>
        </div>
        <ProductGrid products={newest.products} currency={settings.currency} />
      </section>

      {featured.products.length > 0 && (
        <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-10" aria-labelledby="featured">
          <h2 id="featured" className="mb-8 font-display text-3xl sm:text-4xl">
            Featured
          </h2>
          <ProductGrid products={featured.products} currency={settings.currency} />
        </section>
      )}

      {topCategories.length > 0 && (
        <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-10" aria-labelledby="collections">
          <h2 id="collections" className="mb-6 text-xs tracking-[0.25em] text-muted uppercase">
            Collections
          </h2>
          <ul className="divide-y divide-line border-y border-line">
            {topCategories.map((c) => (
              <li key={c.id}>
                <Link href={`/shop/${c.slug}`} className="group flex items-center justify-between py-5">
                  <span className="font-display text-3xl transition-transform duration-300 group-hover:translate-x-2 sm:text-4xl">{c.name}</span>
                  <span aria-hidden className="text-muted transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
