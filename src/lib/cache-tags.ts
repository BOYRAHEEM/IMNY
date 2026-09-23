/**
 * Cache tags for storefront data. Admin actions expire these so changes
 * appear on the store immediately.
 */
export const TAGS = {
  catalog: "catalog", // product lists, categories, search
  settings: "settings", // store settings and delivery zones
  product: (slug: string) => `product:${slug}`,
} as const;
