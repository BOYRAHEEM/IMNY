import type { Metadata } from "next";
import Link from "next/link";
import { BagPill, CustomCursor, FooterSections, NavPills, WelcomeGate } from "@/components/store/chrome";
import { splitList } from "@/content/site";
import { getStoreSettings } from "@/lib/queries/settings";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getStoreSettings();
  const description = s.seo_description ?? s.tagline ?? s.content.hero_text;
  return {
    title: { template: `%s | ${s.store_name}`, default: s.seo_title ?? s.store_name },
    description,
    openGraph: { siteName: s.store_name, type: "website", locale: "en_GH", description },
    twitter: { card: "summary_large_image" },
  };
}

const NAV = [
  { href: "/shop", label: "shop" },
  { href: "/lookbook", label: "lookbook" },
  { href: "/about", label: "about" },
  { href: "/contact", label: "contact" },
];

// Runs before first paint: hides the welcome screen for visitors who already
// entered this session, so it never flashes.
const GATE_SCRIPT = `try{if(sessionStorage.getItem("imny-entered")==="1")document.documentElement.setAttribute("data-imny-entered","1")}catch(e){}`;

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const settings = await getStoreSettings();
  const c = settings.content;
  const messages = splitList(settings.announcement ?? "");
  const socials = (["instagram", "tiktok", "facebook", "x"] as const)
    .map((k) => ({ label: k === "x" ? "x" : k, href: settings.social_links?.[k] }))
    .filter((s): s is { label: string; href: string } => typeof s.href === "string" && s.href.startsWith("https://"));

  return (
    <div className="imny flex min-h-dvh flex-col">
      <script dangerouslySetInnerHTML={{ __html: GATE_SCRIPT }} />
      <WelcomeGate badge={c.splash_badge} est={c.est_label} />
      <CustomCursor />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[600] focus:rounded-full focus:bg-lime focus:px-4 focus:py-2 focus:font-mono focus:text-xs"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-[500] bg-sand/[0.88] px-4 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <Link href="/" className="flex flex-col gap-0.5 leading-none" aria-label={`${settings.store_name} home`}>
            <span className="text-[23px] font-bold tracking-[-0.06em]">{settings.store_name}</span>
            <span className="font-mono text-[9px] font-medium tracking-[0.16em] text-caption">{c.est_label}</span>
          </Link>
          <NavPills links={NAV} />
          <BagPill />
        </div>
      </header>

      {messages.length > 0 && (
        <div className="overflow-hidden bg-violet py-2.5 text-bone" role="marquee" aria-label={messages.join(". ")}>
          <div className="flex w-max animate-marquee" aria-hidden>
            {[0, 1].map((copy) => (
              <div key={copy} className="flex gap-[22px] pr-[22px] font-mono text-xs font-semibold tracking-[0.22em] whitespace-nowrap">
                {[...messages, ...messages].map((m, i) => (
                  <span key={i} className="flex gap-[22px]">
                    <span>{m}</span>
                    <span>·</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="grid gap-[clamp(36px,6vw,64px)] px-[22px] pt-[clamp(40px,7vw,96px)] pb-[26px]">
        <FooterSections heading={c.newsletter_heading} socials={socials} />
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-rule-card pt-[18px] font-mono text-[10px] tracking-[0.18em] text-caption">
          <span>
            © {new Date().getFullYear()} {settings.store_name}
          </span>
          <span>{c.city}</span>
        </div>
      </footer>
    </div>
  );
}
