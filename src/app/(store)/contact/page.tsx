import type { Metadata } from "next";
import { ui } from "@/components/store/ui";
import { getStoreSettings } from "@/lib/queries/settings";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };
export const revalidate = 3600;

export default async function ContactPage() {
  const settings = await getStoreSettings();
  return (
    <>
      <section className="px-[22px] pt-[clamp(28px,5vw,88px)]">
        <h1 className={ui.h1("mb-[18px]")}>say hi</h1>
        <p className="m-0 max-w-[56ch] text-[clamp(17px,2vw,20px)] leading-normal text-copy">{settings.content.contact_intro}</p>
      </section>
      <section className="px-[22px] pt-[clamp(24px,4vw,56px)] pb-[clamp(28px,5vw,72px)]">
        <ContactForm />
      </section>
    </>
  );
}
