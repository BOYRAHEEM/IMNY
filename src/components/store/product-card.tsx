import Image from "next/image";
import Link from "next/link";
import { catalogImageUrl } from "@/lib/images";
import { formatMoney } from "@/lib/money";
import type { ProductCard as Card } from "@/lib/queries/catalog";

export function ProductCard({ product, currency, priority }: { product: Card; currency: string; priority?: boolean }) {
  const image = catalogImageUrl(product.image_path);
  const hover = catalogImageUrl(product.hover_image_path);
  const soldOut = product.available <= 0;
  const onSale = product.compare_at_min !== null && product.compare_at_min > product.price_min;
  const price =
    product.price_min === product.price_max
      ? formatMoney(product.price_min, currency)
      : `From ${formatMoney(product.price_min, currency)}`;

  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-mist">
        {image ? (
          <>
            <Image
              src={image}
              alt={product.image_alt || product.name}
              fill
              sizes="(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              priority={priority}
            />
            {hover && (
              <Image
                src={hover}
                alt=""
                fill
                sizes="(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw"
                className="hidden object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 md:block"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center font-display text-lg text-faint">{product.name}</div>
        )}
        {soldOut ? (
          <span className="absolute top-2 left-2 bg-paper px-2 py-0.5 text-[11px] tracking-wide uppercase">Sold out</span>
        ) : onSale ? (
          <span className="absolute top-2 left-2 bg-ink px-2 py-0.5 text-[11px] tracking-wide text-paper uppercase">Sale</span>
        ) : null}
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="text-sm leading-snug">{product.name}</h3>
        <p className="text-sm text-ink-soft tabular">
          {price}
          {onSale && <s className="ml-2 text-muted">{formatMoney(product.compare_at_min, currency)}</s>}
        </p>
        {product.swatches.length > 1 && (
          <p className="flex items-center gap-1.5 pt-0.5" aria-label={`${product.swatches.length} colours`}>
            {product.swatches.slice(0, 5).map((s) => (
              <span key={s.value} title={s.value} className="size-3 rounded-full border border-line-strong" style={{ background: s.hex }} />
            ))}
            {product.swatches.length > 5 && <span className="text-xs text-muted">+{product.swatches.length - 5}</span>}
          </p>
        )}
      </div>
    </Link>
  );
}

export function ProductGrid({ products, currency, priorityCount = 0 }: { products: Card[]; currency: string; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-y-12">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} currency={currency} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
