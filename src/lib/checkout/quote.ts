import "server-only";
import { z } from "zod";
import { catalogImageUrl } from "@/lib/images";
import { createServiceClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/server";

export const cartLinesSchema = z
  .array(z.object({ variant_id: z.uuid(), quantity: z.number().int().min(1).max(100) }))
  .min(1)
  .max(50);

export type CartLines = z.infer<typeof cartLinesSchema>;

export type QuoteLine = {
  variant_id: string;
  product_id: string | null;
  product_name: string | null;
  product_slug: string | null;
  variant_title: string | null;
  image_url: string | null;
  unit_price_minor: number;
  quantity: number;
  line_total_minor: number;
  available: number;
  status: "ok" | "unavailable" | "insufficient_stock" | "quantity_limit";
  /** Other purchasable variants of the same product, for changing size in the bag. */
  choices: { variant_id: string; title: string; available: number }[];
};

export type Quote = {
  ok: boolean;
  currency: string;
  lines: QuoteLine[];
  subtotal_minor: number;
  discount_minor: number;
  discount: { code: string; error: string | null; message: string | null } | null;
  delivery_fee_minor: number;
  delivery_zone: { id: string; name: string; estimated_days: string | null } | null;
  total_minor: number;
  free_delivery_over_minor: number | null;
};

type RawQuote = Omit<Quote, "lines" | "discount"> & {
  lines: (Omit<QuoteLine, "image_url" | "choices"> & { image_path: string | null })[];
  discount: { code: string; error: string | null; min_order_minor: number | null } | null;
};

export function discountMessage(error: string | null, minOrder: number | null, format: (m: number) => string): string | null {
  switch (error) {
    case null:
      return null;
    case "DISCOUNT_EXPIRED":
      return "That code has expired.";
    case "DISCOUNT_USAGE_LIMIT":
      return "That code has reached its limit.";
    case "DISCOUNT_MIN_ORDER":
      return minOrder ? `Spend ${format(minOrder)} or more to use this code.` : "Your order is below this code's minimum.";
    case "DISCOUNT_CUSTOMER_LIMIT":
      return "You've already used this code.";
    default:
      return "That code isn't valid.";
  }
}

/** Price a bag entirely from the database. Nothing from the browser but ids and quantities is used. */
export async function priceCart(
  lines: CartLines,
  opts: { zoneId?: string | null; code?: string | null; email?: string | null; format: (m: number, c: string) => string },
): Promise<Quote> {
  const { data, error } = await createServiceClient().rpc("price_cart", {
    p_items: lines,
    p_delivery_zone_id: opts.zoneId ?? undefined,
    p_discount_code: opts.code ?? undefined,
    p_email: opts.email ?? undefined,
  });
  if (error) throw error;
  const raw = data as unknown as RawQuote;

  // Sibling variants so shoppers can switch size/colour from the bag.
  const productIds = [...new Set(raw.lines.map((l) => l.product_id).filter(Boolean) as string[])];
  const choicesByProduct = new Map<string, QuoteLine["choices"]>();
  if (productIds.length) {
    const pub = createPublicClient();
    const [{ data: variants }, { data: availability }] = await Promise.all([
      pub.from("product_variants").select("id, product_id, position, variant_title").in("product_id", productIds).order("position"),
      pub.rpc("variant_availability", { p_product_ids: productIds }),
    ]);
    const avail = new Map((availability ?? []).map((a) => [a.variant_id, a.available]));
    for (const v of (variants ?? []) as unknown as { id: string; product_id: string; variant_title: string | null }[]) {
      const list = choicesByProduct.get(v.product_id) ?? [];
      list.push({ variant_id: v.id, title: v.variant_title ?? "Default", available: avail.get(v.id) ?? 0 });
      choicesByProduct.set(v.product_id, list);
    }
  }

  const format = (m: number) => opts.format(m, raw.currency);
  return {
    ...raw,
    discount: raw.discount
      ? { code: raw.discount.code, error: raw.discount.error, message: discountMessage(raw.discount.error, raw.discount.min_order_minor, format) }
      : null,
    lines: raw.lines.map(({ image_path, ...l }) => ({
      ...l,
      image_url: catalogImageUrl(image_path),
      choices: l.product_id ? choicesByProduct.get(l.product_id) ?? [] : [],
    })),
  };
}
