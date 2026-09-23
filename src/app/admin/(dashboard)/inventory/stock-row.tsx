"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Icon } from "@/components/admin/icons";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
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

export function StockRow({ row }: { row: StockRowData }) {
  const [result, action] = useActionState(updateStock, null);
  const saved = result?.ok ? result.data.on_hand : row.on_hand;
  const [value, setValue] = useState(String(row.on_hand));
  const changed = value !== String(saved);
  const available = saved - row.reserved;

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_90px_90px_220px]">
      <div className="min-w-0">
        <Link href={`/admin/products/${row.product_id}`} className="block truncate text-sm font-medium hover:underline">
          {row.product_name}
        </Link>
        <p className="truncate text-xs text-muted">
          {[row.variant_title, row.sku].filter(Boolean).join(" · ") || "Default"}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {row.product_status === "draft" && <Badge>Draft</Badge>}
          {!row.variant_active && <Badge>Off</Badge>}
        </div>
      </div>

      <StockLevel available={available} threshold={row.threshold} className="justify-self-end md:justify-self-start" />

      <p className="hidden text-sm text-muted tabular md:block">{row.reserved > 0 ? `${row.reserved} held` : "—"}</p>

      <form action={action} className="col-span-2 flex items-center gap-2 md:col-span-1">
        <input type="hidden" name="variant_id" value={row.variant_id} />
        <label htmlFor={`stock-${row.variant_id}`} className="shrink-0 text-xs text-muted md:sr-only">
          On hand
        </label>
        <input
          id={`stock-${row.variant_id}`}
          name="on_hand"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          aria-describedby={result && !result.ok ? `stock-${row.variant_id}-error` : undefined}
          className="h-10 w-20 rounded-sm border border-line-strong px-2 text-sm tabular focus:border-ink focus:outline-none"
        />
        <SubmitButton size="sm" variant={changed ? "primary" : "secondary"} disabled={!changed || value === ""} className="h-10">
          Save
        </SubmitButton>
        {result?.ok && !changed && (
          <span role="status" className="flex items-center gap-1 text-xs text-good">
            <Icon name="check" className="size-4" /> Saved
          </span>
        )}
        {row.reserved > 0 && <span className="text-xs text-muted md:hidden">{row.reserved} held</span>}
      </form>
      {result && !result.ok && (
        <p id={`stock-${row.variant_id}-error`} role="alert" className="col-span-2 text-sm text-bad md:col-span-4">
          {result.error}
        </p>
      )}
    </li>
  );
}

function StockLevel({ available, threshold, className }: { available: number; threshold: number; className?: string }) {
  if (available <= 0)
    return (
      <span className={`flex items-center gap-1 text-sm text-bad ${className}`}>
        <Icon name="alert" className="size-4" /> Sold out
      </span>
    );
  if (available <= threshold)
    return (
      <span className={`flex items-center gap-1 text-sm text-warn tabular ${className}`}>
        <Icon name="alert" className="size-4" /> {available} left
      </span>
    );
  return <span className={`text-sm tabular ${className}`}>{available} available</span>;
}
