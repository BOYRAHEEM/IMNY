import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/slug";

/**
 * Shape sent from the product editor to the saveProduct server action, and
 * passed on (after validation) to the admin_save_product database function.
 * The database re-validates everything; this gives clear early errors.
 */

const uuid = z.uuid();
const money = z.number().int().min(0).max(100_000_000); // up to GHS 1,000,000.00
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

export const optionValueSchema = z.object({
  id: uuid,
  value: z.string().trim().min(1, "Option values can't be empty.").max(40),
  swatch_hex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable(),
});

export const optionSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1, "Give each option a name, like Size.").max(40),
  values: z.array(optionValueSchema).min(1, "Each option needs at least one value.").max(50),
});

export const variantSchema = z.object({
  id: uuid,
  option_value_ids: z.array(uuid).max(3),
  sku: optionalText(64),
  price_minor: money,
  compare_at_price_minor: money.nullable(),
  is_active: z.boolean(),
  on_hand: z.number().int().min(0).max(1_000_000).nullable(),
});

export const imageSchema = z.object({
  id: uuid,
  storage_path: z.string().min(1).max(512),
  alt_text: optionalText(300),
  option_value_id: uuid.nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

export const productPayloadSchema = z
  .object({
    id: uuid,
    name: z.string().trim().min(1, "Enter a product name.").max(200),
    slug: z.string().trim().toLowerCase().regex(SLUG_PATTERN, "Use lowercase letters, numbers and dashes only.").max(200),
    description: optionalText(10_000),
    category_id: uuid.nullable(),
    status: z.enum(["draft", "active", "archived"]),
    featured: z.boolean(),
    seo_title: optionalText(120),
    seo_description: optionalText(320),
    options: z.array(optionSchema).max(3, "A product can have at most 3 options."),
    variants: z.array(variantSchema).max(250),
    images: z.array(imageSchema).max(20, "A product can have at most 20 images."),
    primary_image_id: uuid.nullable(),
  })
  .superRefine((p, ctx) => {
    const names = p.options.map((o) => o.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Two options have the same name." });
    }
    for (const o of p.options) {
      const vals = o.values.map((v) => v.value.toLowerCase());
      if (new Set(vals).size !== vals.length) {
        ctx.addIssue({ code: "custom", path: ["options"], message: `"${o.name}" lists the same value twice.` });
      }
    }
    for (const v of p.variants) {
      if (v.option_value_ids.length !== p.options.length) {
        ctx.addIssue({ code: "custom", path: ["variants"], message: "Every variant needs one value for each option." });
        break;
      }
      if (v.compare_at_price_minor !== null && v.compare_at_price_minor <= v.price_minor) {
        ctx.addIssue({
          code: "custom",
          path: ["variants"],
          message: "A 'compare at' price must be higher than the selling price.",
        });
        break;
      }
    }
    const skus = p.variants.map((v) => v.sku?.toUpperCase()).filter(Boolean);
    if (new Set(skus).size !== skus.length) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Two variants have the same SKU." });
    }
    if (p.status === "active" && !p.variants.some((v) => v.is_active)) {
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "To publish, at least one variant must be turned on.",
      });
    }
    for (const img of p.images) {
      if (!img.storage_path.startsWith(`products/${p.id}/`)) {
        ctx.addIssue({ code: "custom", path: ["images"], message: "An image wasn't uploaded correctly." });
        break;
      }
    }
  });

export type ProductPayload = z.infer<typeof productPayloadSchema>;
