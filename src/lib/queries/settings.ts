import "server-only";
import { unstable_cache } from "next/cache";
import { resolveContent, type SiteContent } from "@/content/site";
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
  low_stock_badge_threshold: number;
  hero_image_path: string | null;
  about_image_path: string | null;
  social_links: Record<string, string>;
  seo_title: string | null;
  seo_description: string | null;
  content: SiteContent;
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
  low_stock_badge_threshold: 10,
  hero_image_path: null,
  about_image_path: null,
  social_links: {},
  seo_title: null,
  seo_description: null,
  content: resolveContent({}),
};

// Throws on failure so an error result is never cached.
const loadStoreSettings = unstable_cache(
  async (): Promise<StoreSettings> => {
    const { data, error } = await createPublicClient()
      .from("store_settings")
      .select(
        "store_name, tagline, currency, contact_email, contact_phone, whatsapp_number, announcement, " +
          "free_delivery_over_minor, allow_guest_checkout, max_quantity_per_item, low_stock_badge_threshold, " +
          "hero_image_path, about_image_path, social_links, seo_title, seo_description, content",
      )
      .single();
    if (error || !data) throw error ?? new Error("store_settings row missing");
    const row = data as unknown as Omit<StoreSettings, "content"> & { content: unknown };
    return { ...row, content: resolveContent(row.content) };
  },
  ["store-settings-v2"],
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

export type DeliveryZone = {
  id: string;
  name: string;
  description: string | null;
  fee_minor: number;
  free_over_minor: number | null;
  estimated_days: string | null;
  allow_cod: boolean;
};

const loadZones = unstable_cache(
  async (): Promise<DeliveryZone[]> => {
    const { data, error } = await createPublicClient()
      .from("delivery_zones")
      .select("id, name, description, fee_minor, free_over_minor, estimated_days, allow_cod")
      .eq("is_active", true)
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return data;
  },
  ["delivery-zones-v2"],
  { tags: [TAGS.settings], revalidate: 3600 },
);

export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  try {
    return await loadZones();
  } catch (err) {
    logError("getDeliveryZones", err);
    return [];
  }
}

export type LookbookImage = { id: string; storage_path: string; label: string | null; alt_text: string | null; width: number | null; height: number | null };

const loadLookbook = unstable_cache(
  async (): Promise<LookbookImage[]> => {
    const { data, error } = await createPublicClient()
      .from("lookbook_images")
      .select("id, storage_path, label, alt_text, width, height")
      .order("position")
      .order("created_at");
    if (error) throw error;
    return data;
  },
  ["lookbook"],
  { tags: [TAGS.settings], revalidate: 3600 },
);

export async function getLookbook(): Promise<LookbookImage[]> {
  try {
    return await loadLookbook();
  } catch (err) {
    logError("getLookbook", err);
    return [];
  }
}

export async function getStoreName(): Promise<string> {
  return (await getStoreSettings()).store_name;
}

/**
 * Delivery facts for copy like "free over GHS 3,000, flat GHS 80 under that",
 * derived from settings and zones so it never drifts from what checkout charges.
 */
export function deliverySummary(settings: StoreSettings, zones: DeliveryZone[]) {
  const fees = zones.map((z) => z.fee_minor);
  const minFee = fees.length ? Math.min(...fees) : null;
  const maxFee = fees.length ? Math.max(...fees) : null;
  const zoneThresholds = zones.map((z) => z.free_over_minor).filter((v): v is number => v !== null);
  const freeOver =
    settings.free_delivery_over_minor ?? (zoneThresholds.length === zones.length && zones.length ? Math.max(...zoneThresholds) : null);
  return {
    minFee,
    flatFee: minFee !== null && minFee === maxFee ? minFee : null,
    freeOver,
    codZones: zones.filter((z) => z.allow_cod).map((z) => z.name),
  };
}
