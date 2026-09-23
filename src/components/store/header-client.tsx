"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useCartCount } from "./cart-store";

type NavLink = { href: string; label: string };

export function BagLink() {
  const count = useCartCount();
  return (
    <Link href="/cart" className="flex h-11 items-center gap-1.5 px-2 text-sm" aria-label={`Bag, ${count} item${count === 1 ? "" : "s"}`}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      <span className="tabular">{count > 0 ? count : ""}</span>
    </Link>
  );
}

export function MobileMenu({ links, storeName }: { links: NavLink[]; storeName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="store-menu"
        className="-ml-2 flex size-11 items-center justify-center md:hidden"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <span className="sr-only">Menu</span>
      </button>
      <div className={cn("fixed inset-0 z-50 md:hidden", open ? "visible" : "invisible")} aria-hidden={!open}>
        <div className={cn("absolute inset-0 bg-ink/30 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <nav
          id="store-menu"
          aria-label="Main"
          className={cn(
            "absolute inset-y-0 left-0 flex w-[85vw] max-w-sm flex-col bg-paper px-6 py-5 transition-transform duration-300",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-8 flex items-center justify-between">
            <span className="font-display text-2xl tracking-wide">{storeName}</span>
            <button type="button" onClick={() => setOpen(false)} className="-mr-2 flex size-11 items-center justify-center">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
              <span className="sr-only">Close menu</span>
            </button>
          </div>
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === l.href ? "page" : undefined}
                  className="block py-2.5 font-display text-2xl"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}

export function DesktopNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-7 text-[13px] tracking-wide uppercase">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={cn(
                "border-b py-1 transition-colors",
                pathname === l.href ? "border-ink" : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
