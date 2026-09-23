import { cn } from "@/lib/cn";

/** IMNY design-system class recipes (see design handoff tokens). */

const pillBase =
  "inline-flex items-center justify-center whitespace-nowrap rounded-full font-mono font-semibold transition-[background-color,color,transform,border-color] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50";

export const ui = {
  /** Big black CTA: SHOP THE DROP, ADD TO BAG, KEEP SHOPPING */
  cta: (className?: string) =>
    cn(pillBase, "bg-ink px-10 py-[18px] text-xs tracking-[0.22em] text-bone hover:-translate-y-0.5 hover:bg-violet hover:text-bone", className),
  /** Outlined CTA: SEE THE LOOKS (lime on hover) */
  ctaOutline: (className?: string) =>
    cn(pillBase, "border border-ink px-10 py-[18px] text-xs tracking-[0.22em] hover:bg-lime hover:text-ink", className),
  /** Small outlined nav/link pill: shop, ← back, keep shopping */
  pill: (className?: string) =>
    cn(pillBase, "border border-ink px-4 py-[9px] text-[11px] font-medium tracking-[0.1em] hover:bg-ink hover:text-bone", className),
  /** Lime pill: bag (N), instagram */
  pillLime: (className?: string) =>
    cn(pillBase, "bg-lime px-4 py-[9px] text-[11px] tracking-[0.1em] hover:bg-ink hover:text-bone", className),
  /** Toggle pill (sizes, payment methods). */
  choice: (selected: boolean, className?: string) =>
    cn(
      pillBase,
      "border border-ink px-6 py-[13px] text-xs tracking-[0.08em]",
      selected ? "bg-ink text-bone" : "bg-transparent text-ink hover:bg-ink/5",
      className,
    ),
  /** Static tag badge */
  tag: (tone: "ink" | "lime" | "violet" | "outline", className?: string) =>
    cn(
      "inline-flex items-center whitespace-nowrap rounded-full px-[13px] py-[7px] font-mono text-[10px] font-semibold tracking-[0.16em]",
      tone === "ink" && "bg-ink text-bone",
      tone === "lime" && "bg-lime text-ink",
      tone === "violet" && "bg-violet text-bone",
      tone === "outline" && "border border-ink",
      className,
    ),
  /** Page headline: "shop the fit", "your bag" */
  h1: (className?: string) => cn("m-0 text-[clamp(34px,6.5vw,82px)] leading-[0.9] font-bold tracking-[-0.06em]", className),
  /** Section headline: "the hits" */
  h2: (className?: string) => cn("m-0 text-[clamp(26px,4.2vw,48px)] font-bold tracking-[-0.05em]", className),
  /** Mono section label: "pick a size", "delivery details" */
  label: (className?: string) => cn("font-mono text-[11px] font-semibold tracking-[0.2em] text-label", className),
  /** Mono caption on placeholders and stat labels */
  caption: (className?: string) => cn("font-mono text-[10px] tracking-[0.2em] text-caption", className),
  /** Underline-only input (checkout, contact) */
  input: (invalid?: boolean, className?: string) =>
    cn(
      "w-full rounded-none border-0 border-b bg-transparent px-0.5 py-3 font-mono text-[13px] text-ink focus:border-ink focus:outline-none",
      invalid ? "border-bad" : "border-rule",
      className,
    ),
  /** Page gutter */
  section: (className?: string) => cn("px-[22px] py-[clamp(28px,5vw,72px)]", className),
};
