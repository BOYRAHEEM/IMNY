import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icons";

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: string;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 lg:mb-9">
      {back && (
        <Link
          href={back.href}
          className="-ml-1 mb-4 inline-flex items-center gap-1 font-mono text-[11px] font-semibold tracking-[0.14em] text-label uppercase hover:text-ink"
        >
          <Icon name="left" className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[clamp(30px,4.4vw,48px)] leading-[0.95] font-bold tracking-[-0.05em]">{title}</h1>
          {description && <p className="mt-2.5 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** White content panel used across admin pages. */
export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-3xl border border-line bg-paper", className)}>
      {title && (
        <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-5">
          <h2 className="font-mono text-[11px] font-semibold tracking-[0.18em] text-label uppercase">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Filter pill (orders, products, inventory, inbox views). */
export function filterTab(active: boolean, className?: string) {
  return cn(
    "inline-flex h-9 shrink-0 items-center rounded-full border px-4 font-mono text-xs font-medium tracking-[0.06em] whitespace-nowrap transition-colors",
    active ? "border-ink bg-ink text-bone" : "border-line-strong text-ink-soft hover:border-ink hover:text-ink",
    className,
  );
}

/** Rounded list/table container. */
export const card = "overflow-hidden rounded-3xl border border-line bg-paper";
