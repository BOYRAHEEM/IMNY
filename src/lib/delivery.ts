import type { DeliveryZone } from "@/lib/queries/settings";

/**
 * The zone that delivers to a region (mirrors public.delivery_zone_for_region:
 * zones arrive sorted by sort_order, first match wins). For display only; the
 * server resolves the zone itself when pricing and placing orders.
 */
export function zoneForRegion(zones: DeliveryZone[], region: string | null | undefined): DeliveryZone | null {
  if (!region) return null;
  return zones.find((z) => z.regions.includes(region)) ?? null;
}
