/**
 * Error handling shared by server actions.
 *
 * Database functions raise stable codes (e.g. INSUFFICIENT_STOCK). We map
 * those, and known constraint violations, to plain-English messages. Raw
 * database errors are logged on the server and never sent to the browser.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const GENERIC_ERROR = "Something went wrong. Please try again.";

const CODE_MESSAGES: Record<string, string> = {
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "That item no longer exists.",
  INVALID_ARGUMENT: "Some of the information sent was invalid. Refresh the page and try again.",
  // Catalogue
  VARIANT_OPTIONS_MISMATCH: "Every variant needs one value for each option.",
  VARIANT_OPTION_INVALID: "A variant uses an option value that doesn't belong to this product.",
  VARIANT_HAS_RESERVATIONS:
    "A variant you removed has stock held for an unpaid order. Turn the variant off instead of deleting it.",
  OPTION_NEEDS_VALUES: "Each option needs at least one value.",
  TOO_MANY_OPTIONS: "A product can have at most 3 options.",
  TOO_MANY_VALUES: "An option can have at most 50 values.",
  TOO_MANY_VARIANTS: "A product can have at most 250 variants.",
  TOO_MANY_IMAGES: "A product can have at most 20 images.",
  INVALID_IMAGE_PATH: "One of the images wasn't uploaded correctly. Remove it and upload it again.",
  INVALID_PRICE: "Every variant needs a valid price.",
  PRODUCT_NEEDS_VARIANT: "To publish, at least one variant must be turned on. You can save it as a draft instead.",
  // Stock
  STOCK_BELOW_RESERVED: "Stock can't go below the units currently held for unpaid orders.",
  // Orders
  ORDER_CLOSED: "This order is already delivered or cancelled.",
  ORDER_NOT_PAID: "This order hasn't been paid, so it can't move forward yet.",
  INVALID_STATUS_TRANSITION: "Orders can only move forward, or be cancelled.",
  // Team
  CANNOT_CHANGE_OWN_ROLE: "You can't change your own role.",
  LAST_ADMIN: "There must always be at least one admin.",
  USER_NOT_FOUND: "No account uses that email. Ask them to sign up on the store first.",
};

const CONSTRAINT_MESSAGES: Record<string, string> = {
  products_slug_key: "Another product already uses that web address (slug).",
  categories_slug_key: "Another category already uses that web address (slug).",
  product_variants_sku_key: "One of these SKUs is already used by another product.",
  product_variants_combination_unique: "Two variants have the same combination of options.",
  product_options_name_unique: "Two options have the same name.",
  product_option_values_unique: "An option has the same value listed twice.",
  discount_codes_code_key: "A discount with that code already exists.",
  delivery_zones_name_key: "A delivery zone with that name already exists.",
  discount_percentage_range: "A percentage discount must be between 1 and 100.",
  discount_dates_ordered: "The end date must be after the start date.",
  inventory_reserved_within_on_hand: "Stock can't go below the units currently held for unpaid orders.",
  product_variants_compare_at_price_minor_check: "The 'compare at' price must be higher than the price.",
};

type DbError = { code?: string; message?: string; details?: string | null; hint?: string | null };

/** A safe, human message for staff. Never includes raw SQL or internals. */
export function adminErrorMessage(err: unknown): string {
  const e = (err ?? {}) as DbError;
  const message = e.message ?? "";

  const code = message.match(/^[A-Z][A-Z_]+$/)?.[0];
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  for (const [constraint, text] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (message.includes(constraint) || e.details?.includes(constraint)) return text;
  }

  switch (e.code) {
    case "42501":
      return CODE_MESSAGES.FORBIDDEN;
    case "23503":
      return "This is still in use elsewhere, so it can't be removed.";
    case "23505":
      return "That value is already in use.";
    case "23514":
    case "22P02":
      return "Some of the values entered aren't valid.";
  }
  return GENERIC_ERROR;
}

/** Log technical details server-side for debugging. */
export function logError(context: string, err: unknown): void {
  const e = err as DbError & { stack?: string };
  console.error(`[${context}]`, {
    code: e?.code,
    message: e?.message,
    details: e?.details,
    hint: e?.hint,
    stack: e?.stack,
  });
}

/** Log, then return a failed ActionResult with a safe message. */
export function failure(context: string, err: unknown): { ok: false; error: string } {
  logError(context, err);
  return { ok: false, error: adminErrorMessage(err) };
}
