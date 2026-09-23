import { describe, expect, it } from "vitest";
import { buildPayload, emptyProduct, newId, syncVariants, variantTitle, type EditorOption, type EditorVariant } from "./model";

const opt = (name: string, values: string[]): EditorOption => ({
  id: newId(),
  name,
  values: values.map((value) => ({ id: newId(), value, swatch_hex: null })),
});

describe("syncVariants", () => {
  it("creates one variant per combination, using the default price", () => {
    const colour = opt("Colour", ["Black", "White"]);
    const size = opt("Size", ["S", "M", "L"]);
    const variants = syncVariants([colour, size], [], "150.00", "");
    expect(variants).toHaveLength(6);
    expect(variants.map((v) => variantTitle([colour, size], v))).toEqual([
      "Black / S", "Black / M", "Black / L", "White / S", "White / M", "White / L",
    ]);
    expect(variants.every((v) => v.price === "150.00")).toBe(true);
  });

  it("keeps existing variants (id, stock, price) when a value is added", () => {
    const size = opt("Size", ["S", "M"]);
    const first = syncVariants([size], [], "100", "").map((v, i) => ({ ...v, on_hand: String(i + 5), price: "120" }));
    size.values.push({ id: newId(), value: "L", swatch_hex: null });
    const next = syncVariants([size], first, "100", "");
    expect(next).toHaveLength(3);
    expect(next.slice(0, 2).map((v) => [v.id, v.on_hand, v.price])).toEqual(first.map((v) => [v.id, v.on_hand, v.price]));
    expect(next[2].price).toBe("100");
  });

  it("carries a one-size variant onto the first combination when options are added", () => {
    const base: EditorVariant = { ...emptyProduct().variants[0], on_hand: "9", initial_on_hand: 9 };
    const size = opt("Size", ["S", "M"]);
    const next = syncVariants([size], [base], "", "");
    expect(next[0].id).toBe(base.id);
    expect(next[0].on_hand).toBe("9");
    expect(next[1].id).not.toBe(base.id);
  });

  it("carries variants over when an option is removed", () => {
    const colour = opt("Colour", ["Black", "White"]);
    const size = opt("Size", ["S"]);
    const before = syncVariants([colour, size], [], "1", "");
    const after = syncVariants([colour], before, "1", "");
    expect(after.map((v) => v.id)).toEqual(before.map((v) => v.id));
    expect(after[0].option_value_ids).toEqual([colour.values[0].id]);
  });

  it("refuses to generate more than the limit", () => {
    const big = [opt("A", Array.from({ length: 20 }, (_, i) => `a${i}`)), opt("B", Array.from({ length: 20 }, (_, i) => `b${i}`))];
    const current = syncVariants([], [], "1", "");
    expect(syncVariants(big, current, "1", "")).toBe(current);
  });
});

describe("buildPayload", () => {
  const product = () => {
    const s = emptyProduct();
    s.name = "Linen Dress";
    s.slug = "linen-dress";
    s.variants[0].price = "850";
    return s;
  };

  it("converts prices to pesewas", () => {
    const r = buildPayload(product(), "active");
    expect(r.ok && r.payload.variants[0].price_minor).toBe(85000);
  });

  it("only sends stock that was changed, so concurrent sales aren't overwritten", () => {
    const s = product();
    s.variants[0].initial_on_hand = 4;
    s.variants[0].on_hand = "4";
    const unchanged = buildPayload(s, "draft");
    expect(unchanged.ok && unchanged.payload.variants[0].on_hand).toBeNull();
    s.variants[0].on_hand = "7";
    const changed = buildPayload(s, "draft");
    expect(changed.ok && changed.payload.variants[0].on_hand).toBe(7);
  });

  it("rejects invalid prices and pending uploads with clear messages", () => {
    const s = product();
    s.variants[0].price = "12.345";
    expect(buildPayload(s, "draft")).toEqual({ ok: false, error: "Enter a valid price." });

    const t = product();
    t.images.push({ id: newId(), storage_path: "", alt_text: "", option_value_id: null, width: null, height: null, url: "", uploading: true });
    expect(buildPayload(t, "draft")).toEqual({ ok: false, error: "Wait for images to finish uploading." });
  });
});
