"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { cart } from "./cart-store";
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
  currency: string;
  maxQuantity: number;
  options: ViewOption[];
  variants: SelectableVariant[];
  images: ViewImage[];
  children?: React.ReactNode; // description etc., rendered under the buy box
};

export function ProductView({ name, currency, maxQuantity, options, variants, images, children }: Props) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection>(() => initialSelection(variants, options));
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(false);

  const variant = findVariant(variants, selection, options.length);
  const range = priceRange(variants);
  const available = variant?.available ?? 0;
  const maxQty = Math.max(1, Math.min(available, maxQuantity));
  const qty = Math.min(quantity, maxQty);
  const missing = options.find((_, i) => !selection[i]);
  const everythingSoldOut = variants.every((v) => v.available <= 0);

  // Show photos for the chosen colour (plus photos not tied to a colour).
  const colourIndex = options.findIndex((o) => /colou?r/i.test(o.name));
  const chosenColour = colourIndex >= 0 ? selection[colourIndex] : null;
  const gallery = useMemo(() => {
    if (!chosenColour) return images;
    const filtered = images.filter((img) => !img.option_value_id || img.option_value_id === chosenColour);
    return filtered.length ? filtered : images;
  }, [images, chosenColour]);

  function choose(optionIndex: number, valueId: string) {
    setSelection((s) => select(variants, s, optionIndex, valueId));
    setAdded(null);
    setPrompt(false);
  }

  function addToBag(): boolean {
    if (!variant) {
      setPrompt(true);
      return false;
    }
    if (variant.available <= 0) return false;
    const inBag = cart.add(variant.id, qty, Math.min(variant.available, maxQuantity));
    const label = options.length ? options.map((o, i) => o.values.find((v) => v.id === selection[i])?.value).join(" / ") : name;
    setAdded(inBag < qty ? `Only ${inBag} available — your bag has the maximum.` : `${label} added to your bag.`);
    return true;
  }

  const price = variant
    ? formatMoney(variant.price_minor, currency)
    : range.min === range.max
      ? formatMoney(range.min, currency)
      : `${formatMoney(range.min, currency)} – ${formatMoney(range.max, currency)}`;
  const compareAt = variant?.compare_at_price_minor ?? null;

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:gap-10 lg:gap-16">
      <Gallery images={gallery} name={name} key={chosenColour ?? "all"} />

      <div className="md:sticky md:top-24 md:self-start">
        <h1 className="font-display text-4xl leading-tight font-medium sm:text-5xl">{name}</h1>
        <p className="mt-3 text-lg tabular">
          {price}
          {compareAt && compareAt > (variant?.price_minor ?? 0) && (
            <s className="ml-3 text-base text-muted">{formatMoney(compareAt, currency)}</s>
          )}
        </p>

        <div className="mt-8 space-y-7">
          {options.map((option, i) => {
            const isColour = /colou?r/i.test(option.name);
            const chosen = option.values.find((v) => v.id === selection[i]);
            return (
              <fieldset key={option.id}>
                <legend className="mb-3 text-sm">
                  <span className="text-muted">{option.name}:</span> {chosen?.value ?? ""}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {option.values.map((v) => {
                    const state = valueState(variants, selection, i, v.id);
                    if (state === "unavailable") return null;
                    const selected = selection[i] === v.id;
                    const soldOut = state === "soldout";
                    return isColour && v.swatch_hex ? (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => choose(i, v.id)}
                        disabled={soldOut}
                        aria-pressed={selected}
                        aria-label={`${v.value}${soldOut ? ", sold out" : ""}`}
                        title={`${v.value}${soldOut ? " — sold out" : ""}`}
                        className={cn(
                          "relative flex size-11 items-center justify-center rounded-full border transition-colors",
                          selected ? "border-ink" : "border-transparent hover:border-line-strong",
                          soldOut && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <span className="size-8 rounded-full border border-line-strong" style={{ background: v.swatch_hex }} />
                        {soldOut && <span aria-hidden className="absolute h-px w-9 rotate-45 bg-ink" />}
                      </button>
                    ) : (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => choose(i, v.id)}
                        disabled={soldOut}
                        aria-pressed={selected}
                        aria-label={`${v.value}${soldOut ? ", sold out" : ""}`}
                        className={cn(
                          "h-11 min-w-12 border px-4 text-sm transition-colors",
                          selected ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink",
                          soldOut && "cursor-not-allowed border-line text-faint line-through hover:border-line",
                        )}
                      >
                        {v.value}
                        {soldOut && <span className="sr-only"> (sold out)</span>}
                      </button>
                    );
                  })}
                </div>
                {prompt && !selection[i] && (
                  <p role="alert" className="mt-2 text-sm text-bad">
                    Please choose a {option.name.toLowerCase()}.
                  </p>
                )}
              </fieldset>
            );
          })}

          {variant && available > 0 && available <= 3 && (
            <p className="text-sm text-warn">Only {available} left</p>
          )}

          {!everythingSoldOut && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted" id="qty-label">
                Quantity
              </span>
              <div className="flex h-11 items-center border border-line-strong" role="group" aria-labelledby="qty-label">
                <button type="button" onClick={() => setQuantity(Math.max(1, qty - 1))} disabled={qty <= 1} className="h-full w-11 disabled:text-faint" aria-label="Decrease quantity">
                  −
                </button>
                <span className="w-8 text-center text-sm tabular" aria-live="polite">
                  {qty}
                </span>
                <button type="button" onClick={() => setQuantity(Math.min(maxQty, qty + 1))} disabled={qty >= maxQty || !variant} className="h-full w-11 disabled:text-faint" aria-label="Increase quantity">
                  +
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {everythingSoldOut || (variant && available <= 0) ? (
              <button type="button" disabled className="h-12 w-full cursor-not-allowed bg-line text-sm tracking-wide text-muted uppercase">
                Sold out
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={addToBag}
                  className="h-12 w-full bg-ink text-sm tracking-wide text-paper uppercase transition-colors hover:bg-ink-soft"
                >
                  {missing && prompt ? `Select ${missing.name.toLowerCase()}` : "Add to bag"}
                </button>
                <button
                  type="button"
                  onClick={() => addToBag() && router.push("/checkout")}
                  className="h-12 w-full border border-ink text-sm tracking-wide uppercase transition-colors hover:bg-mist"
                >
                  Buy now
                </button>
              </>
            )}
            <p aria-live="polite" className="min-h-5 text-sm">
              {added && (
                <>
                  {added}{" "}
                  <Link href="/cart" className="underline underline-offset-4">
                    View bag
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

function Gallery({ images, name }: { images: ViewImage[]; name: string }) {
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  if (images.length === 0) {
    return <div className="flex aspect-[4/5] items-center justify-center bg-mist font-display text-2xl text-faint">{name}</div>;
  }

  return (
    <div>
      {/* Phones: swipe */}
      <div className="relative -mx-4 md:hidden">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          aria-label={`${name} photos`}
          role="region"
        >
          {images.map((img, i) => (
            <div key={img.id} className="relative aspect-[4/5] w-full shrink-0 snap-center bg-mist">
              <Image src={img.url} alt={img.alt} fill priority={i === 0} sizes="100vw" className="object-cover" />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
            {images.map((img, i) => (
              <span key={img.id} className={cn("h-1 rounded-full transition-all", i === index ? "w-5 bg-ink" : "w-1.5 bg-ink/30")} />
            ))}
          </div>
        )}
      </div>

      {/* Larger screens: grid */}
      <div className="hidden gap-2 md:grid md:grid-cols-2">
        {images.map((img, i) => (
          <div key={img.id} className={cn("relative aspect-[4/5] bg-mist", i === 0 && images.length % 2 === 1 && "col-span-2")}>
            <Image
              src={img.url}
              alt={img.alt}
              fill
              priority={i === 0}
              sizes={i === 0 && images.length % 2 === 1 ? "(min-width: 1280px) 720px, 58vw" : "(min-width: 1280px) 360px, 29vw"}
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
