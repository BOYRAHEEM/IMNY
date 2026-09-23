import "server-only";
import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/cache-tags";

/**
 * Expire every storefront cache. Admin actions already expire what they
 * change; this is for edits made directly in the Supabase dashboard.
 */
export function revalidateStore() {
  for (const tag of [TAGS.catalog, TAGS.stock, TAGS.settings]) revalidateTag(tag, { expire: 0 });
}
