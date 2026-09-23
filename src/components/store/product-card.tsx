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
  const sizes = "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw";

  return (
    <Link href={`/product/${product.slug}`} className="group block transition-colors duration-200 hover:text-violet">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] transition-[transform,box-shadow] duration-[280ms] ease-out group-hover:-rotate-[0.6deg] group-hover:scale-[1.035] group-hover:shadow-[0_14px_30px_-14px_rgba(20,18,15,0.35)] motion-reduce:group-hover:transform-none">
        {image ? (
          <Image src={image} alt={product.image_alt || product.name} fill sizes={sizes} priority={priority} className="object-cover" />
        ) : (
          <div className="placeholder-stripes absolute inset-0" />
        )}
        {/* Second shot fades in on hover (design's "alt shot"). */}
        {hover ? (
          <Image src={hover} alt="" fill sizes={sizes} className="object-cover opacity-0 transition-opacity duration-[240ms] group-hover:opacity-100" />
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
      <div className="mt-3 flex justify-between gap-3 font-mono text-[11px] font-medium tracking-[0.04em]">
        <span className="uppercase">{product.name}</span>
        <span className="shrink-0 text-label">
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
    <ul className={cn("grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-x-5 gap-y-[30px]", className)}>
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} currency={currency} lowStockUnder={lowStockUnder} index={numbered ? i : undefined} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
