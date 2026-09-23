import type { Metadata } from "next";
import Link from "next/link";
import { BagLink, DesktopNav, MobileMenu } from "@/components/store/header-client";
import { getCategories, safely } from "@/lib/queries/catalog";
import { getStoreSettings } from "@/lib/queries/settings";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getStoreSettings();
  const description = s.seo_description ?? s.tagline ?? undefined;
  return {
    title: { template: `%s | ${s.store_name}`, default: s.seo_title ?? s.store_name },
    description,
    openGraph: { siteName: s.store_name, type: "website", locale: "en_GH", description },
    twitter: { card: "summary_large_image" },
  };
}

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const [settings, categories] = await Promise.all([getStoreSettings(), safely("layout.categories", getCategories, [])]);
  const topLevel = categories.filter((c) => !c.parent_id).slice(0, 6);
  const links = [{ href: "/shop", label: "Shop all" }, ...topLevel.map((c) => ({ href: `/shop/${c.slug}`, label: c.name }))];
  const social = Object.entries(settings.social_links ?? {}).filter(([, url]) => typeof url === "string" && url.startsWith("https://"));

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-paper focus:px-3 focus:py-2">
        Skip to content
      </a>
      {settings.announcement && (
        <p className="bg-ink px-4 py-2 text-center text-xs tracking-wide text-paper">{settings.announcement}</p>
      )}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 lg:px-10">
          <div className="flex items-center">
            <MobileMenu links={links} storeName={settings.store_name} />
            <DesktopNav links={links.slice(0, 5)} />
          </div>
          <Link href="/" className="font-display text-2xl tracking-[0.12em] uppercase sm:text-3xl">
            {settings.store_name}
          </Link>
          <div className="flex justify-end">
            <BagLink />
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="mt-24 border-t border-line bg-mist">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-10">
          <div>
            <p className="font-display text-2xl tracking-[0.12em] uppercase">{settings.store_name}</p>
            {settings.tagline && <p className="mt-2 max-w-xs text-sm text-muted">{settings.tagline}</p>}
          </div>
          <div>
            <h2 className="mb-3 text-xs tracking-widest text-muted uppercase">Shop</h2>
            <ul className="space-y-2 text-sm">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div hidden={!settings.contact_email && !settings.contact_phone && !settings.whatsapp_number && social.length === 0}>
            <h2 className="mb-3 text-xs tracking-widest text-muted uppercase">Contact</h2>
            <ul className="space-y-2 text-sm">
              {settings.contact_email && (
                <li>
                  <a href={`mailto:${settings.contact_email}`} className="hover:underline">
                    {settings.contact_email}
                  </a>
                </li>
              )}
              {settings.contact_phone && (
                <li>
                  <a href={`tel:${settings.contact_phone}`} className="hover:underline">
                    {settings.contact_phone}
                  </a>
                </li>
              )}
              {settings.whatsapp_number && (
                <li>
                  <a href={`https://wa.me/${settings.whatsapp_number.replace(/\D/g, "")}`} className="hover:underline" rel="noopener" target="_blank">
                    WhatsApp
                  </a>
                </li>
              )}
              {social.map(([name, url]) => (
                <li key={name}>
                  <a href={url} className="capitalize hover:underline" rel="noopener" target="_blank">
                    {name === "x" ? "X" : name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="border-t border-line px-4 py-5 text-center text-xs text-muted">
          © {new Date().getFullYear()} {settings.store_name}
        </p>
      </footer>
    </div>
  );
}
