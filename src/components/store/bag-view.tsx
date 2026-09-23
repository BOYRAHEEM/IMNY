"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { cart, useCart, useHydrated } from "./cart-store";
import { useQuote } from "./use-quote";

const PREFS_KEY = "imny-checkout-prefs";

export function readPrefs(): { code?: string } {
  try {
    return JSON.parse(sessionStorage.getItem(PREFS_KEY) ?? "{}");
  } catch {
    return {};
  }
}
export function writePrefs(p: { code?: string }) {
  try {
    sessionStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
}

export function BagView({ maxQuantity }: { maxQuantity: number }) {
  const lines = useCart();
  const hydrated = useHydrated();
  const [code, setCode] = useState<string | null>(() => (typeof window === "undefined" ? null : readPrefs().code ?? null));
  const [codeInput, setCodeInput] = useState(code ?? "");
  const { quote, error, notices, loading } = useQuote(lines, { code });

  if (!hydrated) {
    return (
      <p className="flex items-center gap-2 py-10 text-sm text-muted">
        <Spinner /> Loading your bag…
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="font-display text-4xl">Your bag is waiting.</p>
        <p className="mt-3 text-muted">Nothing in here yet.</p>
        <Link href="/shop" className="mt-8 inline-block bg-ink px-8 py-3.5 text-sm tracking-wide text-paper uppercase hover:bg-ink-soft">
          Continue shopping
        </Link>
      </div>
    );
  }

  const currency = quote?.currency ?? "GHS";
  const money = (m: number) => formatMoney(m, currency);
  const blocking = quote?.lines.some((l) => l.status === "unavailable" || l.available <= 0);

  function applyCode(value: string | null) {
    const next = value?.trim().toUpperCase() || null;
    setCode(next);
    writePrefs({ code: next ?? undefined });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
      <section aria-label="Items">
        {error && (
          <p role="alert" className="mb-4 border border-bad/25 bg-bad-bg px-4 py-3 text-sm text-bad">
            {error}
          </p>
        )}
        {notices.length > 0 && (
          <ul role="status" className="mb-4 space-y-1 border border-warn/25 bg-warn-bg px-4 py-3 text-sm text-warn">
            {notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        {!quote ? (
          <p className="flex items-center gap-2 py-10 text-sm text-muted">
            <Spinner /> Loading your bag…
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {quote.lines.map((line) => {
              const gone = line.status === "unavailable" || line.available <= 0;
              const maxQty = Math.max(1, Math.min(line.available, maxQuantity));
              return (
                <li key={line.variant_id} className="flex gap-4 py-5">
                  <div className="relative aspect-[4/5] w-24 shrink-0 bg-mist sm:w-28">
                    {line.image_url && <Image src={line.image_url} alt="" fill sizes="112px" className={cn("object-cover", gone && "opacity-50")} />}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        {line.product_slug ? (
                          <Link href={`/product/${line.product_slug}`} className="text-sm hover:underline">
                            {line.product_name}
                          </Link>
                        ) : (
                          <p className="text-sm">{line.product_name ?? "Item no longer available"}</p>
                        )}
                        {line.choices.length > 1 && !gone ? (
                          <select
                            aria-label={`Change option for ${line.product_name}`}
                            value={line.variant_id}
                            onChange={(e) => cart.replace(line.variant_id, e.target.value)}
                            className="mt-1 h-9 max-w-full border border-line bg-paper px-2 text-sm text-ink-soft focus:border-ink focus:outline-none"
                          >
                            {line.choices.map((c) => (
                              <option key={c.variant_id} value={c.variant_id} disabled={c.available <= 0 && c.variant_id !== line.variant_id}>
                                {c.title}
                                {c.available <= 0 ? " — sold out" : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          line.variant_title && <p className="mt-1 text-sm text-muted">{line.variant_title}</p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm tabular">{gone ? "" : money(line.unit_price_minor * line.quantity)}</p>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-3">
                      {gone ? (
                        <p className="text-sm text-bad">{line.status === "unavailable" ? "No longer available" : "Sold out"}</p>
                      ) : (
                        <div className="flex h-10 items-center border border-line-strong" role="group" aria-label={`Quantity for ${line.product_name}`}>
                          <button
                            type="button"
                            onClick={() => cart.set(line.variant_id, Math.max(1, line.quantity - 1))}
                            disabled={line.quantity <= 1}
                            className="h-full w-10 disabled:text-faint"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm tabular">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => cart.set(line.variant_id, Math.min(maxQty, line.quantity + 1))}
                            disabled={line.quantity >= maxQty}
                            className="h-full w-10 disabled:text-faint"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      )}
                      <button type="button" onClick={() => cart.remove(line.variant_id)} className="text-sm text-muted underline underline-offset-4 hover:text-ink">
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/shop" className="mt-6 inline-block text-sm underline underline-offset-4">
          Continue shopping
        </Link>
      </section>

      <aside aria-label="Order summary" className="lg:sticky lg:top-24 lg:self-start">
        <div className="bg-mist p-5 sm:p-6">
          <h2 className="mb-5 text-sm tracking-wide uppercase">Summary</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyCode(codeInput);
            }}
            className="mb-5"
          >
            <label htmlFor="bag-code" className="mb-1.5 block text-sm">
              Discount code
            </label>
            <div className="flex gap-2">
              <input
                id="bag-code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                maxLength={32}
                autoCapitalize="characters"
                className="h-11 min-w-0 flex-1 border border-line-strong bg-paper px-3 text-sm uppercase focus:border-ink focus:outline-none"
              />
              {code ? (
                <button type="button" onClick={() => { setCodeInput(""); applyCode(null); }} className="h-11 border border-line-strong bg-paper px-4 text-sm">
                  Remove
                </button>
              ) : (
                <button type="submit" disabled={!codeInput.trim()} className="h-11 border border-ink bg-paper px-4 text-sm disabled:opacity-40">
                  Apply
                </button>
              )}
            </div>
            {quote?.discount?.message && (
              <p role="alert" className="mt-1.5 text-sm text-bad">
                {quote.discount.message}
              </p>
            )}
          </form>

          {quote && (
            <dl className="space-y-2 border-t border-line-strong pt-4 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular">{money(quote.subtotal_minor)}</dd>
              </div>
              {quote.discount_minor > 0 && (
                <div className="flex justify-between text-good">
                  <dt>Discount ({quote.discount?.code})</dt>
                  <dd className="tabular">−{money(quote.discount_minor)}</dd>
                </div>
              )}
              <div className="flex justify-between text-muted">
                <dt>Delivery</dt>
                <dd>Calculated at checkout</dd>
              </div>
              <div className="flex justify-between border-t border-line-strong pt-3 text-base">
                <dt>Estimated total</dt>
                <dd className="tabular">{money(quote.subtotal_minor - quote.discount_minor)}</dd>
              </div>
            </dl>
          )}

          {blocking ? (
            <p className="mt-6 text-sm text-bad">Remove unavailable items to continue.</p>
          ) : (
            <Link
              href="/checkout"
              aria-disabled={!quote || loading}
              className={cn(
                "mt-6 flex h-12 w-full items-center justify-center gap-2 bg-ink text-sm tracking-wide text-paper uppercase hover:bg-ink-soft",
                (!quote || loading) && "pointer-events-none opacity-60",
              )}
            >
              {loading && <Spinner />} Checkout
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}
