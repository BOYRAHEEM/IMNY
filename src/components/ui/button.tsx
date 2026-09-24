import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

// Pill buttons in the store's mono style.
const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-mono font-semibold tracking-[0.06em] " +
  "transition-[background-color,color,border-color] duration-150 disabled:pointer-events-none disabled:opacity-50 select-none";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-bone hover:bg-violet",
  secondary: "border border-ink bg-transparent text-ink hover:bg-lime",
  ghost: "text-ink hover:bg-ink/5",
  danger: "border border-bad/40 bg-transparent text-bad hover:bg-bad-bg",
};

// 44px min height on md for comfortable tapping on phones
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-5 text-[13px]",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
