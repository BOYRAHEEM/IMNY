import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The design's light, Apple-style order summary card (bag + checkout). */
export function SummaryCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <aside
      aria-label="Order summary"
      className={cn(
        "grid gap-6 self-start rounded-3xl border border-rule-soft bg-bone p-[clamp(24px,3.2vw,36px)] font-system text-ink shadow-[0_20px_40px_-28px_rgba(20,18,15,0.18)] md:sticky md:top-[78px]",
        className,
      )}
    >
      <h2 className="m-0 text-[13px] font-semibold tracking-[-0.01em] text-label">Order Summary</h2>
      {children}
    </aside>
  );
}

export function SummaryRow({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex justify-between gap-3", className)}>
      <dt>{label}</dt>
      <dd className="m-0 text-right text-ink tabular">{value}</dd>
    </div>
  );
}

export function SummaryTotal({ value }: { value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-rule-soft pt-5">
      <span className="text-sm text-label">Total</span>
      <span className="text-[clamp(22px,3vw,30px)] font-semibold tracking-[-0.02em] tabular">{value}</span>
    </div>
  );
}

export function summaryButton(className?: string) {
  return cn(
    "flex items-center justify-center gap-2 rounded-[14px] bg-ink px-7 py-4 text-base font-semibold tracking-[-0.01em] text-bone transition duration-150 hover:-translate-y-px hover:bg-violet disabled:pointer-events-none disabled:opacity-50",
    className,
  );
}
