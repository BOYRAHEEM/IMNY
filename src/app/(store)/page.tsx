import Image from "next/image";
import Link from "next/link";
import { ProductGrid } from "@/components/store/product-card";
import { ui } from "@/components/store/ui";
import { splitList } from "@/content/site";
import { catalogImageUrl } from "@/lib/images";
import { listProducts, safely } from "@/lib/queries/catalog";
import { getStoreSettings } from "@/lib/queries/settings";

export const revalidate = 300;

const TAG_TONES = ["ink", "lime", "outline"] as const;

export default async function HomePage() {
  const empty = { products: [], total: 0 };
  const [settings, featured, newest] = await Promise.all([
    getStoreSettings(),
    safely("home.featured", () => listProducts({ featured: true, limit: 4 }), empty),
    safely("home.newest", () => listProducts({ sort: "newest", limit: 4 }), empty),
  ]);
  const c = settings.content;
  const hits = featured.products.length ? featured.products : newest.products;
  const heroImage = catalogImageUrl(settings.hero_image_path);

  return (
    <>
      <section className="relative grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
        <div className="flex min-h-[64vh] flex-col justify-between gap-11 p-[clamp(28px,5vw,72px)]">
          <div className="flex flex-wrap gap-2">
            {splitList(c.hero_badges).map((b, i) => (
              <span key={b} className={ui.tag(TAG_TONES[i % TAG_TONES.length])}>
                {b}
              </span>
            ))}
          </div>
          <div>
            <h1 className="m-0 text-[clamp(48px,9vw,128px)] leading-[0.84] font-bold tracking-[-0.07em] text-balance">{c.hero_heading}</h1>
            <p className="mt-[26px] mb-0 max-w-[42ch] text-[17px] leading-[1.55] text-copy">{c.hero_text}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/shop" className={ui.cta()}>
              SHOP THE DROP
            </Link>
            <Link href="/lookbook" className={ui.ctaOutline()}>
              SEE THE LOOKS
            </Link>
          </div>
        </div>
        <Link
          href="/shop"
          aria-label="Shop the drop"
          className="relative flex min-h-[64vh] items-end overflow-hidden p-5 transition-transform duration-[320ms] ease-out hover:scale-[1.02] motion-reduce:hover:scale-100"
        >
          {heroImage ? (
            <Image src={heroImage} alt="" fill priority sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
          ) : (
            <>
              <span className="placeholder-stripes absolute inset-0" />
              <span className={ui.caption("relative")}>CAMPAIGN IMAGE · 4:5 PORTRAIT</span>
            </>
          )}
          <span className={ui.tag("lime", "absolute top-5 left-5 animate-bob px-5 py-[11px] text-[11px]")}>{c.hero_sticker}</span>
        </Link>
      </section>

      <section className="px-[22px] py-[clamp(28px,5vw,72px)]" aria-labelledby="hits">
        <div className="mb-[26px] flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="hits" className={ui.h2()}>
            {c.featured_heading}
          </h2>
          <Link
            href="/shop"
            className="border-b border-ink pb-0.5 font-mono text-[11px] font-medium tracking-[0.16em] transition-[letter-spacing,color] duration-200 hover:tracking-[0.24em] hover:text-violet"
          >
            see everything →
          </Link>
        </div>
        {hits.length ? (
          <ProductGrid products={hits} currency={settings.currency} lowStockUnder={settings.low_stock_badge_threshold} />
        ) : (
          <p className="font-mono text-xs tracking-[0.1em] text-label">the first drop is on its way.</p>
        )}
      </section>
    </>
  );
}
