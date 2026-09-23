"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { placeOrder } from "@/app/(store)/checkout/actions";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import type { DeliveryZone } from "@/lib/queries/settings";
import { GHANA_REGIONS } from "@/lib/validation/checkout";
import { readPrefs, writePrefs } from "./bag-view";
import { useCart, useHydrated } from "./cart-store";
import { useQuote } from "./use-quote";

type Props = { zones: DeliveryZone[]; currency: string; paymentFailed: boolean; testPayments: boolean };

export function CheckoutView({ zones, currency, paymentFailed, testPayments }: Props) {
  const lines = useCart();
  const hydrated = useHydrated();
  const [zoneId, setZoneId] = useState<string>(zones.length === 1 ? zones[0].id : "");
  const [code, setCode] = useState<string | null>(() => (typeof window === "undefined" ? null : readPrefs().code ?? null));
  const [codeInput, setCodeInput] = useState(code ?? "");
  const [email, setEmail] = useState("");
  const [submitting, startSubmit] = useTransition();
  const [formError, setFormError] = useState<string | null>(
    paymentFailed ? "Your payment wasn't completed and you haven't been charged. Your bag is saved, so you can try again." : null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Email only affects per-customer discount limits; don't re-quote on every keystroke.
  const [quotedEmail, setQuotedEmail] = useState<string | null>(null);
  const { quote, error: quoteError, notices, loading } = useQuote(lines, { zoneId: zoneId || null, code, email: quotedEmail });

  if (!hydrated) {
    return (
      <p className="flex items-center gap-2 py-10 text-sm text-muted">
        <Spinner /> Loading checkout…
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="font-display text-4xl">Your bag is waiting.</p>
        <Link href="/shop" className="mt-8 inline-block bg-ink px-8 py-3.5 text-sm tracking-wide text-paper uppercase">
          Continue shopping
        </Link>
      </div>
    );
  }

  const money = (m: number) => formatMoney(m, quote?.currency ?? currency);
  const unavailable = quote?.lines.some((l) => l.status === "unavailable" || l.available <= 0);

  function applyCode(value: string | null) {
    const next = value?.trim().toUpperCase() || null;
    setCode(next);
    writePrefs({ code: next ?? undefined });
  }

  function submit(form: HTMLFormElement) {
    setFormError(null);
    setFieldErrors({});
    const data = Object.fromEntries(new FormData(form).entries());
    startSubmit(async () => {
      const result = await placeOrder({ ...data, zone_id: zoneId, discount_code: code ?? "" }, lines);
      // On success the action redirects to the payment page.
      if (result && !result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        const first = result.fieldErrors && Object.keys(result.fieldErrors)[0];
        if (first) document.getElementById(`co-${first}`)?.focus();
        else window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  const summary = (
    <div>
      <ul className="space-y-4">
        {quote?.lines.map((l) => (
          <li key={l.variant_id} className="flex gap-3">
            <div className="relative aspect-[4/5] w-16 shrink-0 bg-paper">
              {l.image_url && <Image src={l.image_url} alt="" fill sizes="64px" className="object-cover" />}
              <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-ink text-[11px] text-paper">
                {l.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate">{l.product_name}</p>
              {l.variant_title && <p className="text-muted">{l.variant_title}</p>}
              {l.status !== "ok" && <p className="text-bad">{l.available > 0 ? `Only ${l.available} available` : "Sold out"}</p>}
            </div>
            <p className="text-sm tabular">{money(l.line_total_minor)}</p>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyCode(codeInput);
        }}
        className="mt-6"
      >
        <label htmlFor="co-code" className="mb-1.5 block text-sm">
          Discount code
        </label>
        <div className="flex gap-2">
          <input
            id="co-code"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            maxLength={32}
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
        <dl className="mt-6 space-y-2 border-t border-line-strong pt-4 text-sm">
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
          <div className="flex justify-between">
            <dt>Delivery</dt>
            <dd className="tabular">{!quote.delivery_zone ? "Choose delivery" : quote.delivery_fee_minor ? money(quote.delivery_fee_minor) : "Free"}</dd>
          </div>
          <div className="flex justify-between border-t border-line-strong pt-3 text-base font-medium">
            <dt>Total</dt>
            <dd className="tabular">{money(quote.total_minor)}</dd>
          </div>
        </dl>
      )}
    </div>
  );

  const field = (name: string) => ({
    id: `co-${name}`,
    name,
    "aria-invalid": fieldErrors[name] ? true : undefined,
    "aria-describedby": fieldErrors[name] ? `co-${name}-error` : undefined,
    className: cn(
      "h-12 w-full border bg-paper px-3 text-base focus:border-ink focus:outline-none sm:text-sm",
      fieldErrors[name] ? "border-bad" : "border-line-strong",
    ),
  });
  const err = (name: string) =>
    fieldErrors[name] && (
      <p id={`co-${name}-error`} className="mt-1 text-sm text-bad">
        {fieldErrors[name]}
      </p>
    );
  const label = (name: string, text: string, optional?: boolean) => (
    <label htmlFor={`co-${name}`} className="mb-1.5 block text-sm">
      {text}
      {optional && <span className="text-muted"> (optional)</span>}
    </label>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px] lg:gap-16">
      {/* Phones: collapsible summary at the top */}
      <div className="border-y border-line lg:hidden">
        <button type="button" onClick={() => setSummaryOpen((o) => !o)} aria-expanded={summaryOpen} className="flex h-14 w-full items-center justify-between text-sm">
          <span className="underline underline-offset-4">{summaryOpen ? "Hide" : "Show"} order summary</span>
          <span className="font-medium tabular">{quote ? money(quote.total_minor) : ""}</span>
        </button>
        {summaryOpen && <div className="bg-mist p-4">{summary}</div>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
        noValidate
        className="space-y-10"
      >
        {(formError || quoteError) && (
          <p role="alert" className="border border-bad/25 bg-bad-bg px-4 py-3 text-sm text-bad">
            {formError ?? quoteError}
          </p>
        )}
        {notices.length > 0 && (
          <ul role="status" className="space-y-1 border border-warn/25 bg-warn-bg px-4 py-3 text-sm text-warn">
            {notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        <fieldset className="space-y-4">
          <legend className="mb-4 text-sm tracking-wide uppercase">Contact</legend>
          <div>
            {label("name", "Full name")}
            <input {...field("name")} autoComplete="name" required maxLength={120} />
            {err("name")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              {label("email", "Email")}
              <input
                {...field("email")}
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => code && setQuotedEmail(email.trim().toLowerCase() || null)}
              />
              {err("email")}
            </div>
            <div>
              {label("phone", "Phone")}
              <input {...field("phone")} type="tel" autoComplete="tel" inputMode="tel" required placeholder="024 123 4567" />
              {err("phone")}
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-4 text-sm tracking-wide uppercase">Delivery address</legend>
          <div>
            {label("line1", "Street address or house number")}
            <input {...field("line1")} autoComplete="address-line1" required maxLength={200} />
            {err("line1")}
          </div>
          <div>
            {label("line2", "Area, landmark or apartment", true)}
            <input {...field("line2")} autoComplete="address-line2" maxLength={200} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              {label("city", "Town / city")}
              <input {...field("city")} autoComplete="address-level2" required maxLength={80} />
              {err("city")}
            </div>
            <div>
              {label("region", "Region")}
              <select {...field("region")} defaultValue="" required>
                <option value="" disabled>
                  Choose region
                </option>
                {GHANA_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {err("region")}
            </div>
          </div>
          <div>
            {label("digital_address", "GhanaPost GPS address", true)}
            <input {...field("digital_address")} placeholder="GA-123-4567" maxLength={20} autoCapitalize="characters" />
            {err("digital_address")}
          </div>
          <div>
            {label("instructions", "Delivery instructions", true)}
            <textarea
              {...field("instructions")}
              className={cn(field("instructions").className, "h-auto min-h-20 py-3")}
              maxLength={500}
              rows={3}
              placeholder="e.g. Call when you arrive at the gate"
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-4 text-sm tracking-wide uppercase">Delivery</legend>
          {zones.length === 0 ? (
            <p className="text-sm text-bad">Delivery isn&apos;t available right now. Please contact us to order.</p>
          ) : (
            <div className="divide-y divide-line border border-line-strong" role="radiogroup" aria-label="Delivery options">
              {zones.map((z) => (
                <label key={z.id} className={cn("flex cursor-pointer items-start gap-3 p-4", zoneId === z.id && "bg-mist")}>
                  <input
                    type="radio"
                    name="zone"
                    value={z.id}
                    checked={zoneId === z.id}
                    onChange={() => setZoneId(z.id)}
                    className="mt-0.5 size-5 accent-ink"
                  />
                  <span className="flex-1 text-sm">
                    <span className="block">{z.name}</span>
                    <span className="block text-muted">{[z.description, z.estimated_days].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="text-sm tabular">
                    {zoneId === z.id && quote?.delivery_zone?.id === z.id
                      ? quote.delivery_fee_minor
                        ? money(quote.delivery_fee_minor)
                        : "Free"
                      : z.fee_minor
                        ? money(z.fee_minor)
                        : "Free"}
                  </span>
                </label>
              ))}
            </div>
          )}
          {fieldErrors.zone_id && <p className="mt-1 text-sm text-bad">{fieldErrors.zone_id}</p>}
        </fieldset>

        <div>
          <button
            type="submit"
            disabled={submitting || loading || !quote || unavailable || !zoneId || zones.length === 0}
            className="flex h-14 w-full items-center justify-center gap-2 bg-ink text-sm tracking-wide text-paper uppercase hover:bg-ink-soft disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Spinner /> Taking you to payment…
              </>
            ) : (
              <>Pay {quote && zoneId ? money(quote.total_minor) : ""}</>
            )}
          </button>
          <p className="mt-3 text-center text-xs text-muted">
            {testPayments
              ? "Test mode: no real payment will be taken."
              : "You'll pay securely with card or mobile money on Paystack. We never see your card details."}
          </p>
        </div>
      </form>

      <aside aria-label="Order summary" className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <div className="bg-mist p-6">
          <h2 className="mb-5 text-sm tracking-wide uppercase">Order summary</h2>
          {quote ? summary : <Spinner />}
        </div>
      </aside>
    </div>
  );
}
