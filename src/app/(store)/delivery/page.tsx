import type { Metadata } from "next";
import { StatStrip } from "@/components/store/stat-strip";
import { ui } from "@/components/store/ui";
import { formatMoney } from "@/lib/money";
import { deliverySummary, getDeliveryZones, getStoreSettings } from "@/lib/queries/settings";

export const metadata: Metadata = { title: "Delivery", alternates: { canonical: "/delivery" } };
export const revalidate = 3600;

export default async function DeliveryPage() {
  const [settings, zones] = await Promise.all([getStoreSettings(), getDeliveryZones()]);
  const c = settings.content;
  const money = (m: number) => formatMoney(m, settings.currency);
  const { freeOver, flatFee, minFee, codZones } = deliverySummary(settings, zones);

  // Every number here comes from Settings and Delivery zones.
  let pricing = "";
  if (freeOver !== null && flatFee !== null) pricing = `free over ${money(freeOver)}, flat ${money(flatFee)} under that.`;
  else if (freeOver !== null) pricing = `free over ${money(freeOver)}.`;
  else if (flatFee !== null) pricing = `flat ${money(flatFee)}.`;
  else if (minFee !== null) pricing = `from ${money(minFee)}.`;
  const intro = `we ship across ghana. ${pricing}`.trim();

  const payment = `mobile money, card${codZones.length ? `, or cash on delivery in ${codZones.map((z) => z.toLowerCase()).join(" and ")}` : ""}.`;

  return (
    <>
      <section className="px-[22px] pt-[clamp(28px,5vw,88px)]">
        <h1 className={ui.h1("mb-[18px]")}>delivery</h1>
        <p className="m-0 max-w-[56ch] text-[clamp(17px,2vw,20px)] leading-normal text-copy">{intro}</p>
      </section>

      <StatStrip
        stats={[
          { label: "COVERAGE", value: c.delivery_coverage },
          ...zones.map((z) => ({
            label: z.name.toUpperCase(),
            value: [z.estimated_days, z.fee_minor ? money(z.fee_minor) : "free"].filter(Boolean).join(" · "),
          })),
        ]}
      />

      <section className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-10 px-[22px] pt-[clamp(24px,4vw,48px)] pb-[clamp(28px,5vw,72px)]">
        <div>
          <h2 className={ui.caption("mt-0 mb-2.5 font-semibold tracking-[0.24em]")}>PAYMENT</h2>
          <p className="m-0 text-base leading-[1.65] text-copy">{payment}</p>
        </div>
        <div>
          <h2 className={ui.caption("mt-0 mb-2.5 font-semibold tracking-[0.24em]")}>RETURNS</h2>
          <p className="m-0 text-base leading-[1.65] text-copy">{c.returns_policy}</p>
        </div>
      </section>
    </>
  );
}
