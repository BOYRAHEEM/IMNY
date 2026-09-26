/**
 * Brand copy for the storefront. These are only the DEFAULTS: anything the
 * owner edits in Settings → Pages (stored in store_settings.content) takes
 * precedence. Prices, delivery fees and products never live here.
 */
export const DEFAULT_CONTENT = {
  est_label: "EST '26",
  hero_badges: "AW26 | DELIVERY ONE | 60 UNITS PER COLOUR",
  hero_heading: "main character energy, all day",
  hero_text: "womenswear cut heavy and worn loose. joggers, shorts and the odd tee, made in tiny runs and gone when they're gone.",
  hero_sticker: "just dropped",
  featured_heading: "the hits",
  shop_heading: "shop the fit",
  lookbook_caption: "aw26 · shot in accra",
  about_lead: "Cute fits. Good energy. Main character comfort.",
  about_body:
    "IMNY is for the people who wanna look good and feel good doing it. From flattering joggers to easy everyday shorts, we make pieces that hug the right places, move with your body, and keep the vibe effortless.",
  about_closing: "find your fit. own your vibe. Wear IMNY your way.",
  about_stats: "ESTABLISHED: 2026 | SHIPS FROM: accra, ghana | STOCKISTS: direct only",
  contact_intro: "got a question, an order issue, or a press ask? hmu · we reply within 24hrs.",
  delivery_coverage: "all of ghana",
  returns_policy: "14 days on anything unworn, with tags on.",
  returns_badge: "14-day returns",
  newsletter_heading: "get the drop first",
} as const;

export type ContentKey = keyof typeof DEFAULT_CONTENT;
export type SiteContent = Record<ContentKey, string>;

export function resolveContent(stored: unknown): SiteContent {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_CONTENT } as SiteContent;
  for (const key of Object.keys(DEFAULT_CONTENT) as ContentKey[]) {
    const v = s[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out;
}

/** "A | B | C" -> ["A", "B", "C"] */
export function splitList(value: string): string[] {
  return value
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "LABEL: value | LABEL: value" -> [{ label, value }] */
export function splitStats(value: string): { label: string; value: string }[] {
  return splitList(value).map((item) => {
    const i = item.indexOf(":");
    return i === -1 ? { label: item, value: "" } : { label: item.slice(0, i).trim(), value: item.slice(i + 1).trim() };
  });
}

/** Admin form metadata for the editable fields. */
export const CONTENT_FIELDS: { key: ContentKey; label: string; hint?: string; long?: boolean; group: string }[] = [
  { key: "hero_heading", label: "Homepage headline", group: "Homepage" },
  { key: "hero_text", label: "Homepage intro", long: true, group: "Homepage" },
  { key: "hero_badges", label: "Homepage tags", hint: "Separate with |", group: "Homepage" },
  { key: "hero_sticker", label: "Photo sticker", group: "Homepage" },
  { key: "featured_heading", label: "Featured heading", group: "Homepage" },
  { key: "est_label", label: "Logo caption", group: "Brand" },
  { key: "newsletter_heading", label: "Newsletter heading", group: "Brand" },
  { key: "shop_heading", label: "Shop heading", group: "Pages" },
  { key: "lookbook_caption", label: "Lookbook caption", group: "Pages" },
  { key: "about_lead", label: "About: headline", group: "Pages" },
  { key: "about_body", label: "About: story", long: true, group: "Pages" },
  { key: "about_closing", label: "About: closing line", group: "Pages" },
  { key: "about_stats", label: "About: facts", hint: "LABEL: value | LABEL: value", group: "Pages" },
  { key: "contact_intro", label: "Contact intro", long: true, group: "Pages" },
  { key: "delivery_coverage", label: "Delivery coverage", group: "Policies" },
  { key: "returns_policy", label: "Returns policy", long: true, group: "Policies" },
  { key: "returns_badge", label: "Returns badge (bag page)", group: "Policies" },
];
