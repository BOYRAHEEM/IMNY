import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { StatStrip } from "@/components/store/stat-strip";
import { ui } from "@/components/store/ui";
import { splitStats } from "@/content/site";
import { catalogImageUrl } from "@/lib/images";
import { getStoreSettings } from "@/lib/queries/settings";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getStoreSettings();
  return { title: "About", description: s.content.about_lead, alternates: { canonical: "/about" } };
}

export default async function AboutPage() {
  const settings = await getStoreSettings();
  const c = settings.content;
  const image = catalogImageUrl(settings.about_image_path);

  return (
    <>
      <section className="px-[22px] pt-[clamp(28px,5vw,88px)]">
        <h1 className={ui.h1("mb-[22px] leading-[0.88]")}>about {settings.store_name.toLowerCase()}</h1>
        <p className="m-0 max-w-[62ch] text-[clamp(19px,2.4vw,24px)] leading-normal font-medium text-[#2b2820]">{c.about_lead}</p>
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] items-start gap-12 px-[22px] py-[clamp(24px,4vw,48px)]">
        <div className={image ? "relative aspect-[4/5] overflow-hidden rounded-[22px] bg-track" : "placeholder-stripes flex aspect-[4/5] items-end rounded-[22px] p-4"}>
          {image ? (
            <Image src={image} alt={`Inside the ${settings.store_name} studio`} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
          ) : (
            <span className={ui.caption()}>STUDIO / PROCESS IMAGE</span>
          )}
        </div>
        <div className="self-center">
          <p className="mt-0 mb-5 max-w-[46ch] text-[17px] leading-[1.7] whitespace-pre-line text-copy">{c.about_body}</p>
          <p className="mt-0 mb-6 text-[17px] leading-[1.6] text-copy">{c.about_closing}</p>
          <Link href="/shop" className="inline-flex border-b border-ink font-mono text-xs font-semibold tracking-[0.18em]">
            shop the current run
          </Link>
        </div>
      </section>

      <StatStrip stats={splitStats(c.about_stats)} />
    </>
  );
}
