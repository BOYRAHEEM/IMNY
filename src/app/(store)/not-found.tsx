import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-32 text-center">
      <p className="text-xs tracking-widest text-muted uppercase">404</p>
      <h1 className="mt-3 font-display text-5xl">We couldn&apos;t find that page.</h1>
      <p className="mt-4 text-muted">It may have sold out or moved.</p>
      <Link href="/shop" className="mt-8 inline-block bg-ink px-8 py-3.5 text-sm tracking-wide text-paper uppercase hover:bg-ink-soft">
        Continue shopping
      </Link>
    </div>
  );
}
