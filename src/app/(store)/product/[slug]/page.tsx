import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/store/product-card";
import { ProductView } from "@/components/store/product-view";
import { ui } from "@/components/store/ui";
import { publicEnv } from "@/lib/env";
import { catalogImageUrl } from "@/lib/images";
import { formatMoney } from "@/lib/money";
import { getAvailability, getProductBySlug, listProducts, safely } from "@/lib/queries/catalog";
import { deliverySummary, getDeliveryZones, getStoreSettings } from "@/lib/queries/settings";

export const revalidate = 300;

// Pages are built on first visit, then cached and refreshed when the admin
// edits the product (cache tags) or every 5 minutes for stock.
export async function generateStaticParams() {
  return [];
}

async function load(slug: string) {
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return null;
  return safely("product.load", () => getProductBySlug(slug), null);
}

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const product = await load((await params).slug);
  if (!product) return { title: "Not found" };
  const description = product.seo_description ?? product.description?.slice(0, 160) ?? undefined;
  const image = catalogImageUrl(product.images[0]?.storage_path);
  return {
    title: product.seo_title ?? product.name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      type: "website",
      url: `/product/${product.slug}`,
      images: image ? [{ url: image, width: product.images[0]?.width ?? undefined, height: product.images[0]?.height ?? undefined, alt: product.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const product = await load((await params).slug);
  if (!product || product.variants.length === 0) notFound();

  const [settings, zones, availability, related] = await Promise.all([
    getStoreSettings(),
    getDeliveryZones(),
    safely("product.availability", () => getAvailability([product.id]), {} as Record<string, number>),
    safely(
      "product.related",
      () => listProducts({ categoryId: product.category?.id, exclude: product.id, limit: 4 }),
      { products: [], total: 0 },
    ),
  ]);

  const variants = product.variants.map((v) => ({
    id: v.id,
    values: [v.option1_value_id, v.option2_value_id, v.option3_value_id].filter(Boolean) as string[],
    price_minor: v.price_minor,
    compare_at_price_minor: v.compare_at_price_minor,
    available: availability[v.id] ?? 0,
  }));
  const images = product.images.map((img) => ({
    id: img.id,
    url: catalogImageUrl(img.storage_path)!,
    alt: img.alt_text || product.name,
    width: img.width,
    height: img.height,
    option_value_id: img.option_value_id,
  }));

  const prices = variants.map((v) => v.price_minor);
  const inStock = variants.some((v) => v.available > 0);
  const url = `${publicEnv.NEXT_PUBLIC_SITE_URL}/product/${product.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: images.slice(0, 5).map((i) => i.url),
    sku: product.variants[0]?.sku ?? undefined,
    brand: { "@type": "Brand", name: settings.store_name },
    url,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: settings.currency,
      lowPrice: (Math.min(...prices) / 100).toFixed(2),
      highPrice: (Math.max(...prices) / 100).toFixed(2),
      offerCount: variants.length,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
    },
  };

  const { freeOver, flatFee } = deliverySummary(settings, zones);
  const deliveryLine = [
    "delivery across ghana",
    freeOver !== null ? `free over ${formatMoney(freeOver, settings.currency)}` : null,
    flatFee !== null && flatFee > 0 ? `${formatMoney(flatFee, settings.currency)} under that` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <script
        type="application/ld+json"
        // Escape "<" so product text can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <ProductView
        name={product.name}
        description={product.description}
        currency={settings.currency}
        maxQuantity={settings.max_quantity_per_item}
        lowStockUnder={settings.low_stock_badge_threshold}
        options={product.options}
        variants={variants}
        images={images}
      >
        <ul className="m-0 grid list-none gap-1.5 border-t border-rule p-0 pt-5 font-mono text-[11px] tracking-[0.08em] text-label">
          <li>{deliveryLine}</li>
          <li>{settings.content.returns_policy}</li>
        </ul>
      </ProductView>

      {related.products.length > 0 && (
        <section className="px-[22px] py-[clamp(28px,5vw,72px)]" aria-labelledby="related">
          <h2 id="related" className={ui.h2("mb-[26px]")}>
            more from the drop
          </h2>
          <ProductGrid products={related.products} currency={settings.currency} lowStockUnder={settings.low_stock_badge_threshold} />
        </section>
      )}
    </>
  );
}
