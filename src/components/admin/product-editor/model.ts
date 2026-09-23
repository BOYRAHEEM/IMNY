import { minorToInput, parseMoneyInput } from "@/lib/money";
import type { ProductPayload } from "@/lib/validation/product";

export type EditorValue = { id: string; value: string; swatch_hex: string | null };
export type EditorOption = { id: string; name: string; values: EditorValue[] };

export type EditorVariant = {
  id: string;
  option_value_ids: string[];
  sku: string;
  price: string;
  compare_at: string;
  on_hand: string;
  /** Stock level when the editor loaded. Unchanged stock is not sent, so sales made meanwhile aren't overwritten. */
  initial_on_hand: number | null;
  reserved: number;
  is_active: boolean;
};

export type EditorImage = {
  id: string;
  storage_path: string;
  alt_text: string;
  option_value_id: string | null;
  width: number | null;
  height: number | null;
  url: string;
  uploading?: boolean;
};

export type ProductStatus = "draft" | "active" | "archived";

export type EditorState = {
  id: string;
  isNew: boolean;
  name: string;
  slug: string;
  slugTouched: boolean;
  description: string;
  category_id: string;
  status: ProductStatus;
  featured: boolean;
  seo_title: string;
  seo_description: string;
  price: string;
  compare_at: string;
  options: EditorOption[];
  variants: EditorVariant[];
  images: EditorImage[];
  primary_image_id: string | null;
};

export const MAX_VARIANTS = 250;
export const MAX_OPTIONS = 3;

export const newId = () => crypto.randomUUID();

export function newVariant(option_value_ids: string[], price: string, compare_at: string): EditorVariant {
  return {
    id: newId(),
    option_value_ids,
    sku: "",
    price,
    compare_at,
    on_hand: "0",
    initial_on_hand: null,
    reserved: 0,
    is_active: true,
  };
}

export function emptyProduct(): EditorState {
  return {
    id: newId(),
    isNew: true,
    name: "",
    slug: "",
    slugTouched: false,
    description: "",
    category_id: "",
    status: "draft",
    featured: false,
    seo_title: "",
    seo_description: "",
    price: "",
    compare_at: "",
    options: [],
    variants: [newVariant([], "", "")],
    images: [],
    primary_image_id: null,
  };
}

export function isColourOption(name: string) {
  return /colou?r|shade/i.test(name);
}

export function isSizeOption(name: string) {
  return /size/i.test(name);
}

function cartesian(lists: string[][]): string[][] {
  return lists.reduce<string[][]>((acc, list) => acc.flatMap((combo) => list.map((id) => [...combo, id])), [[]]);
}

export function combinationCount(options: EditorOption[]) {
  return options.reduce((n, o) => n * Math.max(o.values.length, 0), 1);
}

/**
 * Rebuild the variant list after options change. Existing variants keep their
 * id, price, stock and SKU:
 *  1. exact match on the same option values;
 *  2. otherwise carried onto a combination that contains all of its values
 *     (an option was added) or is contained by it (an option was removed).
 */
export function syncVariants(options: EditorOption[], current: EditorVariant[], price: string, compareAt: string): EditorVariant[] {
  const usable = options.filter((o) => o.values.length > 0);
  if (combinationCount(usable) > MAX_VARIANTS) return current;
  const combos = cartesian(usable.map((o) => o.values.map((v) => v.id)));

  const key = (ids: string[]) => ids.join("|");
  const byKey = new Map(current.map((v) => [key(v.option_value_ids), v]));
  const used = new Set<string>();

  const result: Array<EditorVariant | null> = combos.map((combo) => {
    const match = byKey.get(key(combo));
    if (match && !used.has(match.id)) {
      used.add(match.id);
      return { ...match, option_value_ids: combo };
    }
    return null;
  });

  return result.map((r, i) => {
    if (r) return r;
    const combo = combos[i];
    const carried = current.find(
      (v) =>
        !used.has(v.id) &&
        (v.option_value_ids.every((id) => combo.includes(id)) || combo.every((id) => v.option_value_ids.includes(id))),
    );
    if (carried) {
      used.add(carried.id);
      return { ...carried, option_value_ids: combo };
    }
    return newVariant(combo, price, compareAt);
  });
}

export function variantTitle(options: EditorOption[], v: EditorVariant): string {
  const values = new Map(options.flatMap((o) => o.values.map((val) => [val.id, val.value] as const)));
  return v.option_value_ids.map((id) => values.get(id) ?? "?").join(" / ") || "Default";
}

type BuildResult = { ok: true; payload: ProductPayload } | { ok: false; error: string };

/** Convert editor state into the validated server payload. */
export function buildPayload(s: EditorState, status: ProductStatus): BuildResult {
  const options = s.options.filter((o) => o.values.length > 0 || o.name.trim());
  for (const o of options) {
    if (!o.name.trim()) return { ok: false, error: "Give each option a name, like Size or Colour." };
    if (o.values.length === 0) return { ok: false, error: `Add at least one value to "${o.name}".` };
  }

  const variants: ProductPayload["variants"] = [];
  for (const v of s.variants) {
    const label = variantTitle(options, v);
    const price = parseMoneyInput(v.price);
    if (price === null || Number.isNaN(price)) {
      return { ok: false, error: options.length ? `Enter a valid price for ${label}.` : "Enter a valid price." };
    }
    const compare = parseMoneyInput(v.compare_at);
    if (Number.isNaN(compare)) return { ok: false, error: `The 'compare at' price for ${label} isn't valid.` };
    const stockText = v.on_hand.trim();
    const stock = stockText === "" ? 0 : Number(stockText);
    if (!Number.isInteger(stock) || stock < 0) return { ok: false, error: `Stock for ${label} must be a whole number.` };

    variants.push({
      id: v.id,
      option_value_ids: v.option_value_ids,
      sku: v.sku.trim() || null,
      price_minor: price,
      compare_at_price_minor: compare,
      is_active: v.is_active,
      // Only send stock the admin actually changed.
      on_hand: v.initial_on_hand === stock ? null : stock,
    });
  }

  if (s.images.some((i) => i.uploading)) return { ok: false, error: "Wait for images to finish uploading." };

  return {
    ok: true,
    payload: {
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      category_id: s.category_id || null,
      status,
      featured: s.featured,
      seo_title: s.seo_title,
      seo_description: s.seo_description,
      options: options.map((o) => ({ id: o.id, name: o.name, values: o.values })),
      variants,
      images: s.images.map((i) => ({
        id: i.id,
        storage_path: i.storage_path,
        alt_text: i.alt_text,
        option_value_id: i.option_value_id,
        width: i.width,
        height: i.height,
      })),
      primary_image_id: s.primary_image_id && s.images.some((i) => i.id === s.primary_image_id) ? s.primary_image_id : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Loading from the database
// ---------------------------------------------------------------------------

export type DbProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  status: ProductStatus;
  featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  options: { id: string; name: string; position: number; values: { id: string; value: string; swatch_hex: string | null; position: number }[] }[];
  variants: {
    id: string;
    sku: string | null;
    price_minor: number;
    compare_at_price_minor: number | null;
    option1_value_id: string | null;
    option2_value_id: string | null;
    option3_value_id: string | null;
    is_active: boolean;
    position: number;
    inventory: { on_hand: number; reserved: number } | null;
  }[];
  images: {
    id: string;
    storage_path: string;
    alt_text: string | null;
    option_value_id: string | null;
    width: number | null;
    height: number | null;
    position: number;
    is_primary: boolean;
  }[];
};

export function fromDb(p: DbProduct, imageUrl: (path: string) => string): EditorState {
  const options = [...p.options]
    .sort((a, b) => a.position - b.position)
    .map((o) => ({
      id: o.id,
      name: o.name,
      values: [...o.values].sort((a, b) => a.position - b.position).map(({ id, value, swatch_hex }) => ({ id, value, swatch_hex })),
    }));
  const variants = [...p.variants]
    .sort((a, b) => a.position - b.position)
    .map((v) => ({
      id: v.id,
      option_value_ids: [v.option1_value_id, v.option2_value_id, v.option3_value_id].filter(Boolean) as string[],
      sku: v.sku ?? "",
      price: minorToInput(v.price_minor),
      compare_at: minorToInput(v.compare_at_price_minor),
      on_hand: String(v.inventory?.on_hand ?? 0),
      initial_on_hand: v.inventory?.on_hand ?? 0,
      reserved: v.inventory?.reserved ?? 0,
      is_active: v.is_active,
    }));
  const images = [...p.images]
    .sort((a, b) => a.position - b.position)
    .map((i) => ({
      id: i.id,
      storage_path: i.storage_path,
      alt_text: i.alt_text ?? "",
      option_value_id: i.option_value_id,
      width: i.width,
      height: i.height,
      url: imageUrl(i.storage_path),
    }));

  const first = variants[0];
  return {
    id: p.id,
    isNew: false,
    name: p.name,
    slug: p.slug,
    slugTouched: true,
    description: p.description ?? "",
    category_id: p.category_id ?? "",
    status: p.status,
    featured: p.featured,
    seo_title: p.seo_title ?? "",
    seo_description: p.seo_description ?? "",
    price: first?.price ?? "",
    compare_at: first?.compare_at ?? "",
    options,
    variants: variants.length ? variants : [newVariant([], "", "")],
    images,
    primary_image_id: p.images.find((i) => i.is_primary)?.id ?? images[0]?.id ?? null,
  };
}
