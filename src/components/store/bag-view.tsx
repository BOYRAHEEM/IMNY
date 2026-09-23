"use client";

import Image from "next/image";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { cart, useCart, useCartCount, useHydrated } from "./cart-store";
import { SummaryCard, SummaryRow, SummaryTotal, summaryButton } from "./summary-card";
import { ui } from "./ui";
import { useQuote } from "./use-quote";

type Props = {
  maxQuantity: number;
  currency: string;
  /** Free-delivery threshold and the (lowest) delivery fee, from Settings / zones. */
  freeOverMinor: number | null;
  deliveryFeeMinor: number | null;
  flatDelivery: boolean;
  badges: string[];
};

export function BagView({ maxQuantity, currency, freeOverMinor, deliveryFeeMinor, flatDelivery, badges }: Props) {
  const lines = useCart();
  const count = useCartCount();
  const hydrated = useHydrated();
  const { quote, error, notices, loading } = useQuote(lines);

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className={ui.h1()}>your bag</h1>
      <span className={ui.tag("lime", "px-[15px] py-2 text-[11px]")} aria-label={`${count} items`}>
        {hydrated ? count : "…"}
      </span>
    </div>
  );

  if (!hydrated || (lines.length > 0 && !quote && !error)) {
    return (
      <section className={ui.section("grid gap-[clamp(24px,4vw,44px)]")}>
        {header}
        <p className="flex items-center gap-2 font-mono text-xs text-label">
          <Spinner /> loading your bag…
        </p>
      </section>
    );
  }

  if (lines.length === 0) {
    return (
      <section className={ui.section("grid gap-[clamp(24px,4vw,44px)]")}>
        {header}
        <div className="flex flex-col items-start gap-[18px] py-[clamp(32px,6vw,72px)]">
          <p className="m-0 text-[clamp(20px,3vw,30px)] font-bold tracking-[-0.03em] text-copy">nothing in here yet.</p>
          <Link href="/shop" className={ui.cta("px-[38px] py-[17px] hover:translate-y-0")}>
            GO SHOPPING
          </Link>
        </div>
      </section>
    );
  }

  const money = (m: number) => formatMoney(m, quote?.currency ?? currency);
  const merchandise = quote ? quote.subtotal_minor - quote.discount_minor : 0;
  const free = freeOverMinor !== null && merchandise >= freeOverMinor;
  const pct = freeOverMinor ? Math.min(100, Math.round((merchandise / freeOverMinor) * 100)) : 0;
  const delivery = free ? 0 : deliveryFeeMinor;
  const blocking = quote?.lines.some((l) => l.status === "unavailable" || l.available <= 0);

  return (
    <section className={ui.section("grid gap-[clamp(24px,4vw,44px)]")}>
      {header}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-[clamp(24px,4vw,44px)]">
        <div className="grid gap-3.5">
          {error && (
            <p role="alert" className="m-0 rounded-[20px] border border-bad/30 px-4 py-3 font-mono text-xs text-bad">
              {error}
            </p>
          )}
          {notices.map((n) => (
            <p key={n} role="status" className="m-0 rounded-[20px] border border-violet/40 px-4 py-3 font-mono text-xs text-violet">
              {n}
            </p>
          ))}

          {quote?.lines.map((line) => {
            const gone = line.status === "unavailable" || line.available <= 0;
            const maxQty = Math.max(1, Math.min(line.available, maxQuantity));
            const href = line.product_slug ? `/product/${line.product_slug}` : null;
            return (
              <article key={line.variant_id} className={cn("flex items-stretch gap-4 rounded-[20px] border border-rule-card p-3.5", gone && "opacity-60")}>
                <div className="relative aspect-[4/5] w-[92px] shrink-0 overflow-hidden rounded-xl">
                  {line.image_url ? <Image src={line.image_url} alt="" fill sizes="92px" className="object-cover" /> : <span className="placeholder-stripes absolute inset-0" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {href ? (
                        <Link href={href} className="block font-mono text-xs font-semibold tracking-[0.04em] uppercase">
                          {line.product_name}
                        </Link>
                      ) : (
                        <p className="m-0 font-mono text-xs font-semibold uppercase">{line.product_name ?? "no longer available"}</p>
                      )}
                      {line.choices.length > 1 && !gone ? (
                        <select
                          aria-label={`Change size or colour for ${line.product_name}`}
                          value={line.variant_id}
                          onChange={(e) => cart.replace(line.variant_id, e.target.value)}
                          className="mt-1.5 max-w-full cursor-pointer border-0 border-b border-rule bg-transparent py-0.5 font-mono text-[11px] text-label focus:border-ink focus:outline-none"
                        >
                          {line.choices.map((c) => (
                            <option key={c.variant_id} value={c.variant_id} disabled={c.available <= 0 && c.variant_id !== line.variant_id}>
                              {c.title.toLowerCase()}
                              {c.available <= 0 ? " · sold out" : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        line.variant_title && <p className="mt-1.5 mb-0 font-mono text-[11px] text-label">{line.variant_title.toLowerCase()}</p>
                      )}
                    </div>
                    <p className="m-0 font-mono text-xs font-semibold whitespace-nowrap">{gone ? "" : money(line.unit_price_minor * line.quantity)}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    {gone ? (
                      <p className="m-0 font-mono text-[11px] tracking-[0.1em] text-bad">{line.status === "unavailable" ? "NO LONGER AVAILABLE" : "SOLD OUT"}</p>
                    ) : (
                      <div role="group" aria-label={`Quantity for ${line.product_name}`} className="inline-flex items-center gap-0.5 rounded-full border border-ink p-[3px]">
                        <button
                          type="button"
                          onClick={() => (line.quantity <= 1 ? cart.remove(line.variant_id) : cart.set(line.variant_id, line.quantity - 1))}
                          aria-label={line.quantity <= 1 ? "Remove" : "Decrease quantity"}
                          className="size-10 rounded-full font-mono text-sm hover:bg-ink hover:text-bone"
                        >
                          −
                        </button>
                        <span className="min-w-[22px] text-center font-mono text-xs font-semibold">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => cart.set(line.variant_id, Math.min(maxQty, line.quantity + 1))}
                          disabled={line.quantity >= maxQty}
                          aria-label="Increase quantity"
                          className="size-10 rounded-full font-mono text-sm hover:bg-ink hover:text-bone disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
                        >
                          +
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => cart.remove(line.variant_id)}
                      className="border-b border-rule-card p-0 font-mono text-[10px] tracking-[0.16em] text-caption hover:text-violet"
                    >
                      REMOVE
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          <Link href="/shop" className={ui.pill("justify-self-start px-[18px] py-2.5 tracking-[0.14em]")}>
            ← keep shopping
          </Link>
        </div>

        {quote && (
          <SummaryCard>
            {freeOverMinor !== null && (
              <div>
                <p className="mt-0 mb-2.5 text-xs font-medium text-ink">
                  {free ? "free delivery unlocked" : `${money(freeOverMinor - merchandise)} away from free delivery`}
                </p>
                <div
                  className="h-[5px] overflow-hidden rounded-full bg-track"
                  role="progressbar"
                  aria-label="Progress to free delivery"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full bg-ink transition-[width] duration-[260ms]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
            <dl className="m-0 grid gap-3 border-t border-rule-soft pt-5 text-sm text-label">
              <SummaryRow label="Subtotal" value={money(quote.subtotal_minor)} />
              {quote.discount_minor > 0 && <SummaryRow label={`Discount (${quote.discount?.code})`} value={`−${money(quote.discount_minor)}`} />}
              <SummaryRow
                label="Delivery"
                value={delivery === null ? "at checkout" : delivery === 0 ? "FREE" : `${flatDelivery ? "" : "from "}${money(delivery)}`}
              />
            </dl>
            <SummaryTotal value={money(merchandise + (delivery ?? 0))} />
            {blocking ? (
              <p className="m-0 text-sm text-bad">Remove unavailable items to continue.</p>
            ) : (
              <Link href="/checkout" aria-disabled={loading} className={summaryButton(cn(loading && "pointer-events-none opacity-60"))}>
                {loading && <Spinner />} CHECKOUT
              </Link>
            )}
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0 text-[11px] font-medium text-label">
              {badges.map((b) => (
                <li key={b} className="rounded-full border border-rule-soft px-3 py-1.5 whitespace-nowrap">
                  {b}
                </li>
              ))}
            </ul>
          </SummaryCard>
        )}
      </div>
    </section>
  );
}
