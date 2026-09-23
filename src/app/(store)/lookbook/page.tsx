import type { Metadata } from "next";
import Image from "next/image";
import { ui } from "@/components/store/ui";
import { catalogImageUrl } from "@/lib/images";
import { getLookbook, getStoreSettings } from "@/lib/queries/settings";

export const metadata: Metadata = { title: "Lookbook", alternates: { canonical: "/lookbook" } };
export const revalidate = 3600;

const PLACEHOLDER_LOOKS = ["LOOK 01 · FULL LENGTH", "LOOK 02 · DETAIL", "LOOK 03 · BACK", "LOOK 04 · PORTRAIT", "LOOK 05 · PAIR", "LOOK 06 · STILL LIFE"];

export default async function LookbookPage() {
  const [settings, looks] = await Promise.all([getStoreSettings(), getLookbook()]);

  return (
    <section className={ui.section()}>
      <h1 className={ui.h1("mb-2.5")}>lookbook</h1>
      <p className="mt-0 mb-[30px] font-mono text-[11px] font-medium tracking-[0.2em] text-label">{settings.content.lookbook_caption}</p>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4 p-0">
        {looks.length
          ? looks.map((look, i) => (
              <li key={look.id} className="relative aspect-[3/4] overflow-hidden rounded-[20px] bg-mist">
                <Image
                  src={catalogImageUrl(look.storage_path)!}
                  alt={look.alt_text || look.label || `${settings.store_name} look ${i + 1}`}
                  fill
                  priority={i < 2}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
                {look.label && <span className={ui.caption("absolute bottom-3.5 left-3.5 rounded-full bg-bone/85 px-2.5 py-1 tracking-[0.18em] text-ink")}>{look.label}</span>}
              </li>
            ))
          : PLACEHOLDER_LOOKS.map((label) => (
              <li key={label} className="placeholder-stripes flex aspect-[3/4] items-end rounded-[20px] p-3.5">
                <span className={ui.caption("tracking-[0.18em]")}>{label}</span>
              </li>
            ))}
      </ul>
    </section>
  );
}
