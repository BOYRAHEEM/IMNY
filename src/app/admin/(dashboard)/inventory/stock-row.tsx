"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/admin/icons";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";
import { updateStock } from "./actions";

export type StockRowData = {
  variant_id: string;
  product_id: string;
  product_name: string;
  product_status: string;
  variant_title: string | null;
  sku: string | null;
  variant_active: boolean;
  on_hand: number;
  reserved: number;
  available: number;
  threshold: number;
};

/** One size/colour. The product name is shown once above its group (see the page). */
export function StockRow({ row }: { row: StockRowData }) {
  const [result, action] = useActionState(updateStock, null);
  const saved = result?.ok ? result.data.on_hand : row.on_hand;
  const [value, setValue] = useState(String(row.on_hand));
  const changed = value !== String(saved);
  const available = saved - row.reserved;
  const step = (delta: number) => setValue((v) => String(Math.max(0, (Number(v) || 0) + delta)));

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:grid md:grid-cols-[minmax(0,1fr)_90px_90px_220px] md:gap-x-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.variant_title || "Default"}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {row.sku && <span className="truncate">{row.sku}</span>}
          {!row.variant_active && <Badge>Hidden from shop</Badge>}
        </p>
        {/* Phones: stock level under the name, so each size fits on one line. */}
        <StockLevel available={available} threshold={row.threshold} held={row.reserved} className="mt-1 text-xs md:hidden" />
      </div>

      <StockLevel available={available} threshold={row.threshold} className="hidden text-sm md:flex" />
      <p className="hidden text-sm text-muted tabular md:block">{row.reserved > 0 ? `${row.reserved} held` : "—"}</p>

      <form action={action} className="flex items-center gap-1.5">
        <input type="hidden" name="variant_id" value={row.variant_id} />
        <button type="button" onClick={() => step(-1)} aria-label={`One fewer ${row.variant_title ?? ""}`} className={stepper}>
          −
        </button>
        <label htmlFor={`stock-${row.variant_id}`} className="sr-only">
          On hand
        </label>
        <input
          id={`stock-${row.variant_id}`}
          name="on_hand"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          aria-describedby={result && !result.ok ? `stock-${row.variant_id}-error` : undefined}
          className="h-10 w-12 rounded-lg border border-line-strong text-center text-sm tabular focus:border-ink focus:outline-none"
        />
        <button type="button" onClick={() => step(1)} aria-label={`One more ${row.variant_title ?? ""}`} className={stepper}>
          +
        </button>
        {changed ? (
          <SubmitButton size="sm" disabled={value === ""} className="h-10">
            Save
          </SubmitButton>
        ) : (
          result?.ok && (
            <span role="status" className="flex items-center gap-1 text-xs text-good">
              <Icon name="check" className="size-4" /> Saved
            </span>
          )
        )}
      </form>
      {result && !result.ok && (
        <p id={`stock-${row.variant_id}-error`} role="alert" className="w-full text-sm text-bad md:col-span-4">
          {result.error}
        </p>
      )}
    </li>
  );
}

const stepper =
  "flex size-10 shrink-0 items-center justify-center rounded-full border border-line-strong text-lg leading-none hover:border-ink active:bg-mist";

function StockLevel({ available, threshold, held, className }: { available: number; threshold: number; held?: number; className?: string }) {
  const heldNote = held ? <span className="text-muted"> · {held} held</span> : null;
  if (available <= 0)
    return (
      <span className={cn("flex items-center gap-1 text-bad", className)}>
        <Icon name="alert" className="size-4" /> Sold out{heldNote}
      </span>
    );
  if (available <= threshold)
    return (
      <span className={cn("flex items-center gap-1 text-warn tabular", className)}>
        <Icon name="alert" className="size-4" /> {available} left{heldNote}
      </span>
    );
  return (
    <span className={cn("tabular", className)}>
      {available} available{heldNote}
    </span>
  );
}
