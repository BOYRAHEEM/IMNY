"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ui } from "@/components/store/ui";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="flex flex-col items-start gap-6 px-[22px] py-[clamp(48px,9vw,120px)]">
      <h1 className={ui.h1()}>something went wrong.</h1>
      <p className="m-0 max-w-[46ch] text-[17px] leading-[1.6] text-copy">please try again. if it keeps happening, message us and we&apos;ll sort it.</p>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={reset} className={ui.cta()}>
          TRY AGAIN
        </button>
        <Link href="/" className={ui.ctaOutline()}>
          HOME
        </Link>
      </div>
    </section>
  );
}
