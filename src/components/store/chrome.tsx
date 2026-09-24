"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { subscribeNewsletter } from "@/app/(store)/actions";
import { cn } from "@/lib/cn";
import { useCartCount } from "./cart-store";
import { ui } from "./ui";

// ---------------------------------------------------------------------------
// Header bag pill with live count
// ---------------------------------------------------------------------------
export function BagPill() {
  const count = useCartCount();
  return (
    <Link href="/cart" className={ui.pillLime()} aria-label={`Bag, ${count} item${count === 1 ? "" : "s"}`}>
      bag ({count})
    </Link>
  );
}

export function NavPills({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-wrap gap-1.5">
      {links.map((l) => {
        const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href + "/"));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            // Slightly narrower on phones so all four stay on one row.
            className={ui.pill(cn("max-sm:px-3.5 max-sm:text-xs", active && "bg-ink text-bone"))}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Footer: newsletter + link row, each hidden on certain pages (per design)
// ---------------------------------------------------------------------------
const NO_NEWSLETTER = [/^\/cart/, /^\/checkout/, /^\/order-confirmation/, /^\/about/, /^\/product\//, /^\/lookbook/, /^\/contact/];
const NO_LINKS = [/^\/cart/, /^\/checkout/, /^\/product\//];

export function FooterSections({
  heading,
  socials,
}: {
  heading: string;
  socials: { label: string; href: string | null }[];
}) {
  const pathname = usePathname();
  const showNewsletter = !NO_NEWSLETTER.some((re) => re.test(pathname));
  const showLinks = !NO_LINKS.some((re) => re.test(pathname));

  return (
    <>
      {showNewsletter && <Newsletter heading={heading} />}
      {showLinks && socials.length > 0 && (
        <nav aria-label="Social" className="flex flex-wrap gap-2">
          {socials.map((s) =>
            s.href ? (
              <a key={s.label} href={s.href} target="_blank" rel="noopener" className={ui.pillLime("font-medium hover:bg-violet hover:text-bone sm:px-[18px]")}>
                {s.label}
              </a>
            ) : (
              // Link not added yet (Settings → Social): visible, not clickable.
              <span key={s.label} aria-disabled="true" title="Coming soon" className={ui.pillLime("cursor-default font-medium hover:bg-lime hover:text-ink sm:px-[18px]")}>
                {s.label}
              </span>
            ),
          )}
        </nav>
      )}
    </>
  );
}

function Newsletter({ heading }: { heading: string }) {
  const [state, action, pending] = useActionState(subscribeNewsletter, null);
  const done = state?.ok;
  return (
    <form action={action} className="flex flex-wrap items-end justify-between gap-6">
      <p className="m-0 max-w-[20ch] text-[clamp(30px,5.5vw,64px)] leading-[0.9] font-bold tracking-[-0.06em]">{heading}</p>
      <div className="min-w-[260px] flex-[1_1_300px]">
        <div className="flex items-center gap-1 border-b-2 border-ink pb-2">
          <label htmlFor="newsletter-email" className="sr-only">
            Your email
          </label>
          <input
            id="newsletter-email"
            name="email"
            type="email"
            required
            placeholder="your email"
            autoComplete="email"
            disabled={done}
            className="min-w-0 flex-1 border-0 bg-transparent py-2 font-mono text-sm text-ink outline-none"
          />
          {/* Honeypot: real people never fill this in. */}
          <input name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          <button type="submit" disabled={pending || done} className={ui.cta("px-6 py-4 hover:translate-y-0 sm:px-6 sm:py-3 sm:text-[11px] sm:tracking-[0.2em]")}>
            {done ? "YOU'RE IN" : pending ? "…" : "JOIN"}
          </button>
        </div>
        {state && !state.ok && (
          <p role="alert" className="mt-2 font-mono text-xs text-bad">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Welcome screen: once per session, home page only
// ---------------------------------------------------------------------------
const ENTERED_KEY = "imny-entered";
const noop = () => () => {};

/** Lives in the store layout (outside the page-fade wrapper) so it stacks above the header; shows on the home page only. */
export function WelcomeGate({ badge, est }: { badge: string; est: string }) {
  const pathname = usePathname();
  // Server and hydration render the gate; CSS hides it instantly if already entered.
  const alreadyEntered = useSyncExternalStore(
    noop,
    () => {
      try {
        return sessionStorage.getItem(ENTERED_KEY) === "1";
      } catch {
        return true;
      }
    },
    () => false,
  );
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  const visible = !alreadyEntered && !gone && pathname === "/";

  useEffect(() => {
    if (!visible) return;
    button.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  if (!visible) return null;

  function enter() {
    try {
      sessionStorage.setItem(ENTERED_KEY, "1");
    } catch {}
    document.documentElement.dataset.imnyEntered = "1";
    setLeaving(true);
    setTimeout(() => setGone(true), 440);
  }

  const [line1, line2] = badge.split("·").map((s) => s.trim());

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome"
      onKeyDown={(e) => e.key === "Escape" && enter()}
      className={cn(
        "imny-gate fixed inset-0 z-[900] flex flex-col items-center justify-center gap-[30px] overflow-hidden bg-bone transition-opacity duration-[450ms]",
        leaving && "opacity-0",
      )}
    >
      <div
        aria-hidden
        className="absolute top-[8%] right-[6%] flex size-[116px] animate-spin-slow items-center justify-center rounded-full bg-lime text-center font-mono text-[10px] leading-normal font-semibold tracking-[0.18em]"
      >
        {line1}
        {line2 && (
          <>
            <br />
            {line2}
          </>
        )}
      </div>
      <p className="m-0 text-[clamp(66px,19vw,260px)] leading-[0.78] font-bold tracking-[-0.08em]">IMNY</p>
      <p className="m-0 font-mono text-[11px] tracking-[0.3em] text-label">{est}</p>
      <button
        ref={button}
        type="button"
        onClick={enter}
        className="mt-3.5 inline-flex items-center justify-center rounded-full bg-ink px-[58px] py-5 font-mono text-[13px] font-semibold tracking-[0.3em] whitespace-nowrap text-bone transition duration-150 hover:scale-105 hover:bg-violet"
      >
        ENTER →
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom cursor (mouse only; hidden via CSS on touch and reduced motion)
// ---------------------------------------------------------------------------
export function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      el.style.opacity = "1";
      el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="imny-cursor pointer-events-none fixed top-0 left-0 z-[999] -mt-[15px] -ml-[15px] size-[30px] rounded-full border-2 border-violet opacity-0 transition-transform duration-[70ms] ease-linear"
    />
  );
}
