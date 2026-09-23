import Link from "next/link";
import { ui } from "@/components/store/ui";

export default function NotFound() {
  return (
    <section className="flex flex-col items-start gap-6 px-[22px] py-[clamp(48px,9vw,120px)]">
      <span className={ui.tag("violet")}>404</span>
      <h1 className={ui.h1()}>nothing here.</h1>
      <p className="m-0 max-w-[46ch] text-[17px] leading-[1.6] text-copy">it may have sold out or moved.</p>
      <Link href="/shop" className={ui.cta()}>
        GO SHOPPING
      </Link>
    </section>
  );
}
