import "server-only";
import { after } from "next/server";
import { publicEnv } from "@/lib/env";
import { catalogImageUrl } from "@/lib/images";

/**
 * The first request for each size of a photo waits while Vercel resizes it
 * (~0.6–0.8 s extra); after that it's cached for a year and survives deploys.
 * When the dashboard saves a new photo, request the sizes shoppers actually
 * use in the background, so the first customer gets the cached version.
 *
 * Widths come from the storefront's <Image sizes>: bag thumbnails 256, cards
 * 384–750, product page and hero 640–1200 (1920 for the hero on big screens).
 * Only AVIF is warmed: nearly every current browser takes it, and each warmed
 * size counts towards Vercel's image allowance.
 */
const WIDTHS = [256, 384, 640, 750, 828, 1080, 1200];
const QUALITY = 60; // must match images.qualities in next.config.ts
const AT_ONCE = 4;

export function warmImages(paths: (string | null | undefined)[], { large = false } = {}) {
  const sources = [...new Set(paths)].map(catalogImageUrl).filter((u): u is string => Boolean(u));
  if (sources.length === 0) return;
  const widths = large ? [...WIDTHS, 1920] : WIDTHS;
  const urls = sources.flatMap((src) =>
    widths.map((w) => `${publicEnv.NEXT_PUBLIC_SITE_URL}/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${QUALITY}`),
  );

  // Runs after the dashboard has its response, so saving never waits for it.
  after(async () => {
    for (let i = 0; i < urls.length; i += AT_ONCE) {
      await Promise.all(
        urls.slice(i, i + AT_ONCE).map((url) =>
          fetch(url, { headers: { Accept: "image/avif,image/webp,*/*" }, signal: AbortSignal.timeout(20_000) })
            .then((res) => res.arrayBuffer())
            .catch(() => {}), // best effort: a miss just means the first shopper waits a moment
        ),
      );
    }
  });
}
