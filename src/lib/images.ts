import { publicEnv } from "@/lib/env";

export const CATALOG_BUCKET = "catalog";

/** Public URL of a file in the catalog bucket. */
export function catalogImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${CATALOG_BUCKET}/${encoded}`;
}

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
/** Largest original we accept from a phone before compressing. */
export const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
/** Storage bucket limit (enforced server-side by Supabase too). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
