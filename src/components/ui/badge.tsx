import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "dark";

const tones: Record<Tone, string> = {
  neutral: "bg-mist text-ink-soft border-line-strong",
  good: "bg-good-bg text-good border-good/20",
  warn: "bg-warn-bg text-warn border-warn/20",
  bad: "bg-bad-bg text-bad border-bad/20",
  info: "bg-info-bg text-info border-info/20",
  dark: "bg-ink text-bone border-ink",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] font-mono text-[10px] font-semibold tracking-[0.1em] whitespace-nowrap uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
