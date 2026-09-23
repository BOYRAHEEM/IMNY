import "server-only";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { logError } from "@/lib/errors";
import { createPublicClient } from "@/lib/supabase/server";

export type StoreSettings = {
  store_name: string;
  tagline: string | null;
  currency: string;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp_number: string | null;
  announcement: string | null;
  free_delivery_over_minor: number | null;
  allow_guest_checkout: boolean;
  max_quantity_per_item: number;
  social_links: Record<string, string>;
  seo_title: string | null;
  seo_description: string | null;
};

const FALLBACK: StoreSettings = {
  store_name: "Store",
  tagline: null,
  currency: "GHS",
  contact_email: null,
  contact_phone: null,
  whatsapp_number: null,
  announcement: null,
  free_delivery_over_minor: null,
  allow_guest_checkout: true,
  max_quantity_per_item: 10,
  social_links: {},
  seo_title: null,
  seo_description: null,
};

// Throws on failure so an error result is never cached.
const loadStoreSettings = unstable_cache(
  async (): Promise<StoreSettings> => {
    const { data, error } = await createPublicClient()
      .from("store_settings")
      .select(
        "store_name, tagline, currency, contact_email, contact_phone, whatsapp_number, announcement, " +
          "free_delivery_over_minor, allow_guest_checkout, max_quantity_per_item, social_links, seo_title, seo_description",
      )
      .single();
    if (error || !data) throw error ?? new Error("store_settings row missing");
    return data as unknown as StoreSettings;
  },
  ["store-settings"],
  { tags: [TAGS.settings], revalidate: 3600 },
);

/** Public store settings, cached and expired whenever an admin saves settings. */
export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    return await loadStoreSettings();
  } catch (err) {
    logError("getStoreSettings", err);
    return FALLBACK;
  }
}

export async function getStoreName(): Promise<string> {
  return (await getStoreSettings()).store_name;
}
