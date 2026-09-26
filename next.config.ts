import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Tailwind's CSS is small (~12 KB compressed); shipping it inside the HTML
    // saves a render-blocking request, which matters most on slow phone data.
    inlineCss: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Quality 60 looks the same as 75 on phone screens at about half the bytes.
    qualities: [60],
    // Uploads are capped at 2400px on the long edge (1920px wide for a 4:5
    // photo), so the 2048/3840 defaults only bloat every srcset.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Every upload gets a new file name, so an optimised image never goes stale.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/catalog/**" }]
      : [],
  },
  // Sorted and paged shop views go to a cached route, so /shop and category
  // pages can stay prebuilt (reading ?sort= in a page would make it render
  // on every visit). Shoppers keep seeing the /shop?sort=… URL.
  async rewrites() {
    const sort = { type: "query" as const, key: "sort", value: "(?<sort>newest|price_asc|price_desc)" };
    const page = { type: "query" as const, key: "page", value: "(?<page>[1-9][0-9]{0,2})" };
    const views = (source: string, category: string) => [
      { source, has: [sort, page], destination: `/shop-view/${category}/:sort/:page` },
      { source, has: [sort], destination: `/shop-view/${category}/:sort/1` },
      { source, has: [page], destination: `/shop-view/${category}/newest/:page` },
    ];
    return { beforeFiles: [...views("/shop", "_all"), ...views("/shop/:category", ":category")], afterFiles: [], fallback: [] };
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
