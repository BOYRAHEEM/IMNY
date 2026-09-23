/**
 * Pure helpers for choosing a variant from option values on the product page.
 * Options are chosen in order (e.g. Colour, then Size); a value's state only
 * depends on the choices made in EARLIER options, so picking a size never
 * greys out colours.
 */

export type SelectableVariant = {
  id: string;
  /** option value id per option index (same order as the product's options) */
  values: string[];
  price_minor: number;
  compare_at_price_minor: number | null;
  available: number;
};

export type ValueState = "available" | "soldout" | "unavailable";

export type Selection = Array<string | null>;

function compatible(v: SelectableVariant, selection: Selection, upTo: number) {
  for (let j = 0; j < upTo; j++) {
    if (selection[j] && v.values[j] !== selection[j]) return false;
  }
  return true;
}

export function valueState(variants: SelectableVariant[], selection: Selection, optionIndex: number, valueId: string): ValueState {
  const matching = variants.filter((v) => v.values[optionIndex] === valueId && compatible(v, selection, optionIndex));
  if (matching.length === 0) return "unavailable";
  return matching.some((v) => v.available > 0) ? "available" : "soldout";
}

export function findVariant(variants: SelectableVariant[], selection: Selection, optionCount: number): SelectableVariant | null {
  if (optionCount === 0) return variants[0] ?? null;
  if (selection.length < optionCount || selection.some((s) => !s)) return null;
  return variants.find((v) => v.values.every((id, i) => id === selection[i])) ?? null;
}

/** Choose a value; later choices that are no longer possible are cleared. */
export function select(variants: SelectableVariant[], selection: Selection, optionIndex: number, valueId: string): Selection {
  const next = [...selection];
  next[optionIndex] = valueId;
  for (let j = optionIndex + 1; j < next.length; j++) {
    const current = next[j];
    if (current && valueState(variants, next, j, current) !== "available") next[j] = null;
  }
  return next;
}

/**
 * Starting selection: options with a single possible value are pre-chosen,
 * and the first option is pre-chosen if it's a colour (so the gallery and
 * price reflect something real). Sizes are left for the shopper to pick.
 */
export function initialSelection(
  variants: SelectableVariant[],
  options: { name: string; values: { id: string }[] }[],
): Selection {
  let selection: Selection = options.map(() => null);
  options.forEach((o, i) => {
    const possible = o.values.filter((v) => valueState(variants, selection, i, v.id) !== "unavailable");
    const inStock = possible.filter((v) => valueState(variants, selection, i, v.id) === "available");
    if (possible.length === 1) selection = select(variants, selection, i, possible[0].id);
    else if (i === 0 && /colou?r/i.test(o.name) && (inStock[0] ?? possible[0])) {
      selection = select(variants, selection, i, (inStock[0] ?? possible[0]).id);
    }
  });
  return selection;
}

export function priceRange(variants: SelectableVariant[]) {
  const prices = variants.map((v) => v.price_minor);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}
