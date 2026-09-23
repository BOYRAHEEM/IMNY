"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-32 text-center">
      <h1 className="font-display text-4xl">Something went wrong.</h1>
      <p className="mt-4 text-muted">Please try again. If it keeps happening, contact us and we&apos;ll help.</p>
      <div className="mt-8 flex justify-center gap-4">
        <button type="button" onClick={reset} className="bg-ink px-8 py-3.5 text-sm tracking-wide text-paper uppercase">
          Try again
        </button>
        <Link href="/" className="px-4 py-3.5 text-sm underline underline-offset-4">
          Home
        </Link>
      </div>
    </div>
  );
}
