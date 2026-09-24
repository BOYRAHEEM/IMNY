"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { cart } from "./cart-store";
import { ui } from "./ui";
import {
  findVariant,
  initialSelection,
  priceRange,
  select,
  valueState,
  type SelectableVariant,
  type Selection,
} from "./variant-selection";

export type ViewOption = { id: string; name: string; values: { id: string; value: string; swatch_hex: string | null }[] };
export type ViewImage = { id: string; url: string; alt: string; width: number | null; height: number | null; option_value_id: string | null };

type Props = {
  name: string;
  description: string | null;
  currency: string;
  maxQuantity: number;
  lowStockUnder: number;
  options: ViewOption[];
  variants: SelectableVariant[];
  images: ViewImage[];
  children?: React.ReactNode;
};

const isColour = (name: string) => /colou?r/i.test(name);
const isSize = (name: string) => /size/i.test(name);

/** The design pre-selects M when that size is in stock. */
function designDefault(variants: SelectableVariant[], options: ViewOption[]): Selection {
  let sel = initialSelection(variants, options);
  options.forEach((o, i) => {
    if (sel[i] || !isSize(o.name)) return;
    const m = o.values.find((v) => v.value.toUpperCase() === "M");
    if (m && valueState(variants, sel, i, m.id) === "available") sel = select(variants, sel, i, m.id);
  });
  return sel;
}

export function ProductView({ name, description, currency, maxQuantity, lowStockUnder, options, variants, images, children }: Props) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection>(() => designDefault(variants, options));
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const variant = findVariant(variants, selection, options.length);
  const range = priceRange(variants);
  const totalAvailable = variants.reduce((n, v) => n + Math.max(0, v.available), 0);
  const soldOut = totalAvailable <= 0;
  const lowStock = !soldOut && totalAvailable < lowStockUnder;
  const available = variant?.available ?? 0;
  const maxQty = Math.max(1, Math.min(available, maxQuantity));
  const qty = Math.min(quantity, maxQty);

  const colourIndex = options.findIndex((o) => isColour(o.name));
  const chosenColour = colourIndex >= 0 ? selection[colourIndex] : null;
  const gallery = useMemo(() => {
    if (!chosenColour) return images;
    const filtered = images.filter((img) => !img.option_value_id || img.option_value_id === chosenColour);
    return filtered.length ? filtered : images;
  }, [images, chosenColour]);

  function choose(i: number, valueId: string) {
    setSelection((s) => select(variants, s, i, valueId));
    setPrompt(false);
    setNotice(null);
  }

  function addToBag(): boolean {
    if (!variant) {
      setPrompt(true);
      return false;
    }
    if (variant.available <= 0) return false;
    const before = qty;
    const inBag = cart.add(variant.id, qty, Math.min(variant.available, maxQuantity));
    setNotice(inBag < before ? `only ${inBag} available, so your bag has the max.` : null);
    setJustAdded(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 1600);
    return true;
  }

  const price = variant
    ? formatMoney(variant.price_minor, currency)
    : range.min === range.max
      ? formatMoney(range.min, currency)
      : `${formatMoney(range.min, currency)} – ${formatMoney(range.max, currency)}`;
  const compareAt = variant?.compare_at_price_minor ?? null;
  const missing = options.find((_, i) => !selection[i]);

  return (
    // Phones: photos edge to edge (no outer padding); tablet up: padded 2-column layout.
    <section className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 sm:p-4">
      <Gallery key={chosenColour ?? "all"} images={gallery} name={name} lowStock={lowStock} />

      <div className="flex flex-col gap-7 self-start p-[clamp(20px,4vw,56px)] md:sticky md:top-[74px]">
        <Link href="/shop" className={ui.pill("self-start px-4 py-2 tracking-[0.14em]")}>
          ← back
        </Link>

        <div>
          <h1 className="m-0 text-[clamp(28px,4.2vw,52px)] leading-[0.98] font-bold tracking-[-0.05em] uppercase">{name}</h1>
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5 font-mono text-[15px] font-semibold">
            <span>{price}</span>
            {compareAt && compareAt > (variant?.price_minor ?? 0) && <s className="text-caption">{formatMoney(compareAt, currency)}</s>}
            {soldOut ? (
              <span className={ui.tag("ink", "px-3 py-1.5")}>SOLD OUT</span>
            ) : lowStock ? (
              <span className={ui.tag("violet", "px-3 py-1.5")}>LOW STOCK</span>
            ) : null}
          </div>
        </div>

        {description && <p className="m-0 max-w-[46ch] text-base leading-[1.65] whitespace-pre-line text-copy">{description}</p>}

        {options.map((option, i) => {
          const chosen = option.values.find((v) => v.id === selection[i]);
          const colour = isColour(option.name);
          return (
            <fieldset key={option.id} className="m-0 border-0 p-0">
              <legend className={ui.label("mb-3 p-0")}>
                {colour ? `colour · ${chosen?.value.toUpperCase() ?? "pick one"}` : isSize(option.name) ? "pick a size" : option.name.toLowerCase()}
              </legend>
              <div className={cn("flex flex-wrap", colour ? "gap-2.5" : "gap-2")}>
                {option.values.map((v) => {
                  const state = valueState(variants, selection, i, v.id);
                  if (state === "unavailable") return null;
                  const selected = selection[i] === v.id;
                  const out = state === "soldout";
                  if (colour && v.swatch_hex) {
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => choose(i, v.id)}
                        disabled={out}
                        aria-pressed={selected}
                        aria-label={`${v.value}${out ? ", sold out" : ""}`}
                        title={`${v.value}${out ? " · sold out" : ""}`}
                        style={{ background: v.swatch_hex }}
                        className={cn(
                          "relative size-11 cursor-pointer rounded-full p-0",
                          selected ? "border-2 border-ink shadow-[0_0_0_3px_#fbfaf8,0_0_0_4px_#14120f]" : "border border-rule",
                          out && "cursor-not-allowed opacity-40",
                        )}
                      >
                        {out && <span aria-hidden className="absolute top-1/2 left-1/2 h-px w-10 -translate-x-1/2 rotate-45 bg-ink" />}
                      </button>
                    );
                  }
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => choose(i, v.id)}
                      disabled={out}
                      aria-pressed={selected}
                      aria-label={`${v.value}${out ? ", sold out" : ""}`}
                      className={ui.choice(selected, cn(out && "border-rule text-caption line-through opacity-100"))}
                    >
                      {v.value}
                    </button>
                  );
                })}
              </div>
              {prompt && !selection[i] && (
                <p role="alert" className="mt-2.5 mb-0 font-mono text-xs text-violet">
                  pick a {option.name.toLowerCase()} first.
                </p>
              )}
            </fieldset>
          );
        })}

        {variant && available > 0 && available <= 3 && (
          <p className="m-0 font-mono text-xs tracking-[0.08em] text-violet">only {available} left in this one</p>
        )}

        {!soldOut && (
          <div className="flex items-center gap-4">
            <span id="qty-label" className={ui.label()}>
              qty
            </span>
            <div role="group" aria-labelledby="qty-label" className="inline-flex items-center gap-0.5 rounded-full border border-ink p-[3px]">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, qty - 1))}
                disabled={qty <= 1}
                aria-label="Decrease quantity"
                className="size-10 rounded-full font-mono text-sm hover:bg-ink hover:text-bone disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
              >
                −
              </button>
              <span className="min-w-[22px] text-center font-mono text-xs font-semibold" aria-live="polite">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(Math.min(maxQty, qty + 1))}
                disabled={qty >= maxQty || !variant}
                aria-label="Increase quantity"
                className="size-10 rounded-full font-mono text-sm hover:bg-ink hover:text-bone disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
              >
                +
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {soldOut || (variant && available <= 0) ? (
            <button type="button" disabled className={ui.cta("w-full py-5 text-[13px] tracking-[0.26em]")}>
              SOLD OUT
            </button>
          ) : (
            <>
              <button type="button" onClick={addToBag} className={ui.cta("w-full py-5 text-[13px] tracking-[0.26em]")} aria-live="polite">
                {justAdded ? "IN YOUR BAG" : prompt && missing ? `PICK A ${missing.name.toUpperCase()}` : "ADD TO BAG"}
              </button>
              <button type="button" onClick={() => addToBag() && router.push("/checkout")} className={ui.ctaOutline("w-full py-4")}>
                BUY NOW
              </button>
            </>
          )}
          {(justAdded || notice) && (
            <p className="m-0 font-mono text-xs tracking-[0.06em] text-label">
              {notice ?? "added."}{" "}
              <Link href="/cart" className="border-b border-ink text-ink">
                view bag
              </Link>
            </p>
          )}
        </div>

        {children}
      </div>
    </section>
  );
}

function Gallery({ images, name, lowStock }: { images: ViewImage[]; name: string; lowStock: boolean }) {
  const [index, setIndex] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  // Two placeholder shots until real photos are uploaded (per design).
  const shots: (ViewImage | { id: string; placeholder: string })[] = images.length
    ? images
    : [
        { id: "ph1", placeholder: "PRODUCT SHOT 01" },
        { id: "ph2", placeholder: "PRODUCT SHOT 02 · DETAIL" },
      ];

  function go(i: number) {
    const el = strip.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setIndex(i);
  }

  return (
    <div>
      <div
        ref={strip}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (i !== index) setIndex(i);
        }}
        role="region"
        aria-label={`${name} photos`}
        tabIndex={0}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto sm:rounded-[22px]"
      >
        {shots.map((shot, i) => (
          <div
            key={shot.id}
            className={cn("relative flex aspect-[4/5] flex-[0_0_100%] snap-start items-end p-4", "placeholder" in shot && (i % 2 ? "placeholder-stripes-alt" : "placeholder-stripes"))}
          >
            {"placeholder" in shot ? (
              <span className={ui.caption("relative")}>{shot.placeholder}</span>
            ) : (
              <Image
                src={shot.url}
                alt={shot.alt}
                fill
                priority={i === 0}
                sizes="(min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
            )}
            {i === 0 && lowStock && <span className={ui.tag("violet", "absolute top-3.5 right-3.5 px-3.5 py-2")}>LOW STOCK</span>}
          </div>
        ))}
      </div>
      {shots.length > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {shots.map((shot, i) => (
            <button
              key={shot.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show photo ${i + 1} of ${shots.length}`}
              aria-current={i === index ? "true" : undefined}
              className="flex h-8 w-10 items-center justify-center"
            >
              <span className={cn("block h-1.5 rounded-full transition-all duration-200", i === index ? "w-[22px] bg-ink" : "w-1.5 bg-rule")} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
