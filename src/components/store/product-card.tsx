import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { catalogImageUrl } from "@/lib/images";
import { formatMoney } from "@/lib/money";
import type { ProductCard as Card } from "@/lib/queries/catalog";
import { ui } from "./ui";

type Props = {
  product: Card;
  currency: string;
  lowStockUnder: number;
  index?: number; // shows "01" etc. on the shop page
  priority?: boolean;
};

export function ProductCard({ product, currency, lowStockUnder, index, priority }: Props) {
  const image = catalogImageUrl(product.image_path);
  const hover = catalogImageUrl(product.hover_image_path);
  const soldOut = product.available <= 0;
  const lowStock = !soldOut && product.available < lowStockUnder;
  const onSale = product.compare_at_min !== null && product.compare_at_min > product.price_min;
  const price =
    product.price_min === product.price_max ? formatMoney(product.price_min, currency) : `from ${formatMoney(product.price_min, currency)}`;
  const sizes = "(min-width: 1280px) 25vw, (min-width: 640px) 33vw, 50vw";

  return (
    <Link href={`/product/${product.slug}`} className="group block transition-colors duration-200 hover:text-violet">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[14px] bg-track transition-[transform,box-shadow] sm:aspect-[4/5] sm:rounded-[18px] duration-[280ms] ease-out group-hover:-rotate-[0.6deg] group-hover:scale-[1.035] group-hover:shadow-[0_14px_30px_-14px_rgba(20,18,15,0.35)] motion-reduce:group-hover:transform-none">
        {image ? (
          <Image src={image} alt={product.image_alt || product.name} fill sizes={sizes} priority={priority} className="object-cover" />
        ) : (
          <div className="placeholder-stripes absolute inset-0" />
        )}
        {/* Second shot fades in on hover (design's "alt shot"). Hidden on touch
            screens, where it can't be seen, so phones don't download it. */}
        {hover ? (
          <Image src={hover} alt="" fill sizes={sizes} className="hidden object-cover opacity-0 transition-opacity duration-[240ms] group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:block" />
        ) : (
          !image && (
            <div className="placeholder-stripes-alt absolute inset-0 flex items-end p-3 opacity-0 transition-opacity duration-[240ms] group-hover:opacity-100">
              <span className={ui.caption()}>ALT SHOT</span>
            </div>
          )
        )}
        {soldOut ? (
          <span className={ui.tag("ink", "absolute top-2.5 left-2.5 px-[11px] py-1.5 text-[9px]")}>SOLD OUT</span>
        ) : lowStock ? (
          <span className={ui.tag("violet", "absolute top-2.5 left-2.5 px-[11px] py-1.5 text-[9px]")}>LOW STOCK</span>
        ) : onSale ? (
          <span className={ui.tag("lime", "absolute top-2.5 left-2.5 px-[11px] py-1.5 text-[9px]")}>SALE</span>
        ) : null}
        {index !== undefined && (
          <span className={ui.caption("absolute right-2.5 bottom-2.5 tracking-[0.16em]")}>{String(index + 1).padStart(2, "0")}</span>
        )}
      </div>
      <div className="mt-2.5 flex flex-col gap-1 font-mono text-[13px] leading-snug font-medium tracking-[0.02em] sm:mt-3 sm:flex-row sm:justify-between sm:gap-3 sm:text-[11px] sm:tracking-[0.04em]">
        <span className="uppercase">{product.name}</span>
        <span className="text-label sm:shrink-0">
          {price}
          {onSale && <s className="ml-1.5 text-caption">{formatMoney(product.compare_at_min, currency)}</s>}
        </span>
      </div>
    </Link>
  );
}

export function ProductGrid({
  products,
  currency,
  lowStockUnder,
  numbered,
  priorityCount = 0,
  className,
}: {
  products: Card[];
  currency: string;
  lowStockUnder: number;
  numbered?: boolean;
  priorityCount?: number;
  className?: string;
}) {
  return (
    // Phones: two columns bleeding into the page gutter (12px edges) so photos are as large as possible.
    // Tablet up: as many 230px+ columns as fit (per design).
    <ul
      className={cn(
        "-mx-2.5 grid grid-cols-2 gap-x-2 gap-y-6 sm:mx-0 sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] sm:gap-x-5 sm:gap-y-[30px]",
        className,
      )}
    >
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} currency={currency} lowStockUnder={lowStockUnder} index={numbered ? i : undefined} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
