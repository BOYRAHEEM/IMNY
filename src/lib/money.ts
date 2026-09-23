/**
 * Money is always integer minor units (pesewas for GHS). Convert only at the
 * edges: formatting for display and parsing admin input.
 */

export function formatMoney(minor: number | bigint | null | undefined, currency = "GHS"): string {
  const value = Number(minor ?? 0) / 100;
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })
      .format(value)
      .replace(/ /g, " ");
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Compact form for stat tiles: GHS 12.9K */
export function formatMoneyCompact(minor: number | null | undefined, currency = "GHS"): string {
  const value = Number(minor ?? 0) / 100;
  if (Math.abs(value) < 10_000) return formatMoney(minor, currency);
  return `${currency} ${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
}

/** Major-unit string for form inputs: 85000 -> "850.00", null -> "" */
export function minorToInput(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  return (minor / 100).toFixed(2);
}

/**
 * Parse admin input like "850", "850.5", "1,250.00" into minor units.
 * Returns null for empty input and NaN for invalid input.
 */
export function parseMoneyInput(input: string | null | undefined): number | null {
  const s = (input ?? "").replace(/[,\s]/g, "").replace(/^GHS/i, "");
  if (s === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return Number.NaN;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
