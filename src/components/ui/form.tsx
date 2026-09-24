import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-xl border border-line-strong bg-paper px-3.5 text-sm text-ink placeholder:text-faint " +
  "focus:border-ink focus:outline-none focus-visible:outline-none disabled:bg-mist disabled:text-muted " +
  "aria-[invalid=true]:border-bad";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-11 appearance-none bg-no-repeat pr-9", className)} style={chevron} {...props}>
      {children}
    </select>
  );
}

const chevron = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b6760' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundPosition: "right 0.75rem center",
};

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-2 block font-mono text-[11px] font-semibold tracking-[0.14em] text-label uppercase", className)} {...props} />;
}

/** Label + control + hint/error, wired up for screen readers. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1 font-normal tracking-normal text-faint normal-case">(optional)</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-sm text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, hint, className, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 py-1", className)}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-ink" {...props} />
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Top-of-form banner for action results. */
export function FormMessage({ result }: { result?: { ok: boolean; error?: string; message?: string } | null }) {
  if (!result) return null;
  if (!result.ok && result.error) {
    return (
      <p role="alert" className="rounded-xl border border-bad/25 bg-bad-bg px-3 py-2.5 text-sm text-bad">
        {result.error}
      </p>
    );
  }
  if (result.ok && result.message) {
    return (
      <p role="status" className="rounded-xl border border-good/25 bg-good-bg px-3 py-2.5 text-sm text-good">
        {result.message}
      </p>
    );
  }
  return null;
}
