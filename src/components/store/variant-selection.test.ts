import { describe, expect, it } from "vitest";
import { findVariant, initialSelection, select, valueState, type SelectableVariant } from "./variant-selection";

// Oversized Hoodie: Black S4 M8 L2 XL0, White S3 M5 L7, no White/XL variant
const stock: Record<string, number> = { "B-S": 4, "B-M": 8, "B-L": 2, "B-XL": 0, "W-S": 3, "W-M": 5, "W-L": 7 };
const variants: SelectableVariant[] = Object.entries(stock).map(([k, available]) => {
  const [c, s] = k.split("-");
  return { id: k, values: [c, s], price_minor: 45000, compare_at_price_minor: null, available };
});
const options = [
  { name: "Colour", values: [{ id: "B" }, { id: "W" }] },
  { name: "Size", values: [{ id: "S" }, { id: "M" }, { id: "L" }, { id: "XL" }] },
];

describe("variant selection", () => {
  it("marks only the sold-out size as sold out, not the whole product", () => {
    const sel = ["B", null];
    expect(options[1].values.map((v) => valueState(variants, sel, 1, v.id))).toEqual(["available", "available", "available", "soldout"]);
  });

  it("marks a size that doesn't exist for this colour as unavailable", () => {
    expect(valueState(variants, ["W", null], 1, "XL")).toBe("unavailable");
  });

  it("colours are judged independently of the chosen size", () => {
    expect(valueState(variants, ["B", "XL"], 0, "W")).toBe("available");
  });

  it("clears a size that isn't possible after changing colour", () => {
    expect(select(variants, ["W", "L"], 0, "B")).toEqual(["B", "L"]);
    expect(select(variants, ["B", "XL"], 0, "W")).toEqual(["W", null]);
  });

  it("finds the variant only when every option is chosen", () => {
    expect(findVariant(variants, ["B", null], 2)).toBeNull();
    expect(findVariant(variants, ["W", "M"], 2)?.id).toBe("W-M");
  });

  it("pre-selects the first in-stock colour but not a size", () => {
    expect(initialSelection(variants, options)).toEqual(["B", null]);
  });

  it("handles one-size products", () => {
    const one = [{ id: "only", values: [], price_minor: 5000, compare_at_price_minor: null, available: 2 }];
    expect(findVariant(one, [], 0)?.id).toBe("only");
    expect(initialSelection(one, [])).toEqual([]);
  });
});
