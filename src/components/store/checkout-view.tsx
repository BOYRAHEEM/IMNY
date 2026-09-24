"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { placeOrder } from "@/app/(store)/checkout/actions";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { zoneForRegion } from "@/lib/delivery";
import { formatMoney } from "@/lib/money";
import type { DeliveryZone } from "@/lib/queries/settings";
import { GHANA_REGIONS } from "@/lib/validation/checkout";
import { useCart, useHydrated } from "./cart-store";
import { readPrefs, writePrefs } from "./checkout-prefs";
import { SummaryCard, SummaryRow, SummaryTotal, summaryButton } from "./summary-card";
import { ui } from "./ui";
import { useQuote } from "./use-quote";

type Method = "momo" | "card" | "cod";
type Props = { zones: DeliveryZone[]; currency: string; paymentFailed: boolean; testPayments: boolean };

const METHODS: { key: Method; label: string }[] = [
  { key: "momo", label: "MOBILE MONEY" },
  { key: "card", label: "CARD" },
  { key: "cod", label: "PAY ON DELIVERY" },
];

export function CheckoutView({ zones, currency, paymentFailed, testPayments }: Props) {
  const lines = useCart();
  const hydrated = useHydrated();
  const [region, setRegion] = useState("");
  const [method, setMethod] = useState<Method>("momo");
  const [code, setCode] = useState<string | null>(() => (typeof window === "undefined" ? null : readPrefs().code ?? null));
  const [codeInput, setCodeInput] = useState(code ?? "");
  const [email, setEmail] = useState("");
  const [quotedEmail, setQuotedEmail] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [formError, setFormError] = useState<string | null>(
    paymentFailed ? "your payment wasn't completed and you haven't been charged. your bag is saved, so you can try again." : null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { quote, error: quoteError, notices, loading } = useQuote(lines, { region: region || null, code, email: quotedEmail });

  const zone = zoneForRegion(zones, region);
  const codZones = zones.filter((z) => z.allow_cod);
  const codAllowed = Boolean(zone?.allow_cod);
  const effectiveMethod: Method = method === "cod" && !codAllowed ? "momo" : method;

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className={ui.h1()}>checkout</h1>
      <Link href="/cart" className="border-b border-ink font-mono text-[11px] font-medium tracking-[0.14em]">
        back to bag
      </Link>
    </div>
  );

  if (!hydrated) {
    return (
      <section className={ui.section("grid gap-[clamp(24px,4vw,44px)]")}>
        {header}
        <p className="flex items-center gap-2 font-mono text-xs text-label">
          <Spinner /> loading checkout…
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
          <Link href="/shop" className={ui.cta("sm:px-[38px] sm:py-[17px]")}>
            GO SHOPPING
          </Link>
        </div>
      </section>
    );
  }

  const money = (m: number) => formatMoney(m, quote?.currency ?? currency);
  const unavailable = quote?.lines.some((l) => l.status === "unavailable" || l.available <= 0);
  const ready = Boolean(quote && zone && !unavailable && !loading);

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
      const result = await placeOrder({ ...data, payment_method: effectiveMethod, discount_code: code ?? "" }, lines);
      // On success the action redirects (to the payment page, or the confirmation for cash).
      if (result && !result.ok) {
        setFormError(result.error.toLowerCase());
        setFieldErrors(result.fieldErrors ?? {});
        const first = result.fieldErrors && Object.keys(result.fieldErrors)[0];
        if (first) document.getElementById(`co-${first}`)?.focus();
        else window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  const field = (name: string, extra?: string) => ({
    id: `co-${name}`,
    name,
    "aria-invalid": fieldErrors[name] ? true : undefined,
    "aria-describedby": fieldErrors[name] ? `co-${name}-error` : undefined,
    className: ui.input(Boolean(fieldErrors[name]), extra),
  });
  const err = (name: string) =>
    fieldErrors[name] && (
      <p id={`co-${name}-error`} className="mt-1 mb-0 font-mono text-[11px] text-bad">
        {fieldErrors[name]}
      </p>
    );

  return (
    <section className={ui.section("grid gap-[clamp(24px,4vw,44px)]")}>
      {header}

      <form
        id="checkout-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
        noValidate
        className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-[clamp(24px,4vw,44px)]"
      >
        <div className="grid gap-7">
          {(formError || quoteError) && (
            <p role="alert" className="m-0 rounded-[20px] border border-bad/30 px-4 py-3 font-mono text-xs text-bad">
              {formError ?? quoteError}
            </p>
          )}
          {notices.map((n) => (
            <p key={n} role="status" className="m-0 rounded-[20px] border border-violet/40 px-4 py-3 font-mono text-xs text-violet">
              {n}
            </p>
          ))}

          <fieldset className="m-0 border-0 p-0">
            <legend className={ui.label("mb-3.5 p-0")}>delivery details</legend>
            <div className="grid gap-3.5">
              <div>
                <input {...field("name")} placeholder="full name" aria-label="Full name" autoComplete="name" required maxLength={120} />
                {err("name")}
              </div>
              <div>
                <input
                  {...field("email")}
                  type="email"
                  placeholder="email (for your receipt)"
                  aria-label="Email"
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
                <input {...field("phone")} type="tel" placeholder="phone number" aria-label="Phone number" autoComplete="tel" inputMode="tel" required />
                {err("phone")}
              </div>
              <div>
                <input {...field("line1")} placeholder="delivery address" aria-label="Delivery address" autoComplete="address-line1" required maxLength={200} />
                {err("line1")}
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <input {...field("city")} placeholder="city / town" aria-label="City or town" autoComplete="address-level2" required maxLength={80} />
                  {err("city")}
                </div>
                <div>
                  <select {...field("region", "cursor-pointer")} aria-label="Region" value={region} onChange={(e) => setRegion(e.target.value)} required>
                    <option value="" disabled>
                      region
                    </option>
                    {GHANA_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r.toLowerCase()}
                      </option>
                    ))}
                  </select>
                  {err("region")}
                </div>
              </div>
              <textarea {...field("instructions", "resize-y")} rows={2} maxLength={500} placeholder="delivery notes (optional)" aria-label="Delivery instructions" />
            </div>
          </fieldset>

          {/* Delivery is worked out from the region; nothing to pick. */}
          <div aria-live="polite">
            <p className={ui.label("mt-0 mb-2.5")}>delivery</p>
            {!region ? (
              <p className="m-0 text-[13px] text-caption">choose your region above to see delivery time and cost.</p>
            ) : !zone ? (
              <p className="m-0 text-[13px] text-bad">sorry, we don&apos;t deliver to {region.toLowerCase()} yet.</p>
            ) : (
              <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[22px] border border-ink px-[18px] py-3 font-mono text-xs font-semibold">
                <span>{zone.name.toUpperCase()}</span>
                <span className="font-medium text-label">
                  {[
                    zone.estimated_days,
                    quote?.delivery_zone?.id === zone.id ? (quote.delivery_fee_minor ? money(quote.delivery_fee_minor) : "FREE") : money(zone.fee_minor),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            )}
          </div>

          <fieldset className="m-0 border-0 p-0">
            <legend className={ui.label("mb-3.5 p-0")}>payment method</legend>
            <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Payment method">
              {METHODS.filter((m) => m.key !== "cod" || codZones.length > 0).map((m) => {
                const disabled = m.key === "cod" && !codAllowed;
                return (
                  <button
                    key={m.key}
                    type="button"
                    role="radio"
                    aria-checked={effectiveMethod === m.key}
                    disabled={disabled}
                    title={disabled ? `Only for ${codZones.map((z) => z.name).join(", ")}` : undefined}
                    onClick={() => setMethod(m.key)}
                    className={ui.choice(effectiveMethod === m.key, "px-[18px] tracking-[0.06em] disabled:opacity-35 sm:py-3")}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="m-0 text-[13px] leading-relaxed text-caption">
              {effectiveMethod === "cod"
                ? `pay in cash when your order arrives in ${zone?.name.toLowerCase() ?? "your area"}.`
                : effectiveMethod === "momo"
                  ? "you'll approve the payment on your phone on paystack's secure page. mtn, telecel and airteltigo all work."
                  : "you'll enter your card on paystack's secure page. we never see or store your card details."}
              {codZones.length > 0 && !codAllowed && zone && ` pay on delivery is only available for ${codZones.map((z) => z.name.toLowerCase()).join(", ")}.`}
            </p>
          </fieldset>
        </div>

        <SummaryCard className="gap-5">
          <ul className="m-0 grid list-none gap-3 p-0">
            {quote?.lines.map((l) => (
              <li key={l.variant_id} className="flex items-center gap-3 text-sm">
                <div className="relative aspect-[4/5] w-11 shrink-0 overflow-hidden rounded-lg">
                  {l.image_url ? <Image src={l.image_url} alt="" fill sizes="44px" className="object-cover" /> : <span className="placeholder-stripes absolute inset-0" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate">{l.product_name}</p>
                  <p className="m-0 text-xs text-label">
                    {[l.variant_title, `× ${l.quantity}`].filter(Boolean).join(" · ")}
                    {l.status !== "ok" && <span className="text-bad"> · {l.available > 0 ? `only ${l.available} left` : "sold out"}</span>}
                  </p>
                </div>
                <span className="tabular">{money(l.line_total_minor)}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 border-t border-rule-soft pt-5">
            <label htmlFor="co-code" className="sr-only">
              Discount code
            </label>
            <input
              id="co-code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyCode(codeInput);
                }
              }}
              maxLength={32}
              placeholder="Discount code"
              className="h-10 min-w-0 flex-1 rounded-[10px] border border-rule-soft bg-paper px-3 text-sm uppercase placeholder:normal-case focus:border-ink focus:outline-none"
            />
            {code ? (
              <button type="button" onClick={() => { setCodeInput(""); applyCode(null); }} className="h-10 rounded-[10px] border border-rule-soft px-3 text-sm">
                Remove
              </button>
            ) : (
              <button type="button" onClick={() => applyCode(codeInput)} disabled={!codeInput.trim()} className="h-10 rounded-[10px] border border-ink px-3 text-sm disabled:opacity-40">
                Apply
              </button>
            )}
          </div>
          {quote?.discount?.message && (
            <p role="alert" className="-mt-2 mb-0 text-sm text-bad">
              {quote.discount.message}
            </p>
          )}

          {quote && (
            <dl className="m-0 grid gap-3 text-sm text-label">
              <SummaryRow label="Subtotal" value={money(quote.subtotal_minor)} />
              {quote.discount_minor > 0 && <SummaryRow label={`Discount (${quote.discount?.code})`} value={`−${money(quote.discount_minor)}`} />}
              <SummaryRow label="Delivery" value={!quote.delivery_zone ? "choose area" : quote.delivery_fee_minor ? money(quote.delivery_fee_minor) : "FREE"} />
            </dl>
          )}
          <SummaryTotal value={quote ? money(quote.total_minor) : "—"} />
          <button type="submit" form="checkout-form" disabled={!ready || submitting} className={summaryButton()}>
            {submitting ? (
              <>
                <Spinner /> {effectiveMethod === "cod" ? "PLACING ORDER…" : "TAKING YOU THERE…"}
              </>
            ) : effectiveMethod === "cod" ? (
              "PLACE ORDER"
            ) : (
              "CHECKOUT"
            )}
          </button>
          <p className={cn("m-0 text-center text-xs text-label", !zone && "text-violet")}>
            {!region ? "add your delivery region to continue." : !zone ? "we don't deliver to that region yet." : testPayments && effectiveMethod !== "cod" ? "test mode: no real payment will be taken." : "secure checkout"}
          </p>
        </SummaryCard>
      </form>
    </section>
  );
}
