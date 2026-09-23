"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { variantTitle, type EditorOption, type EditorVariant } from "./model";

type Props = {
  options: EditorOption[];
  variants: EditorVariant[];
  onChange: (variants: EditorVariant[]) => void;
};

/** Per-variant price, stock, SKU and on/off. Cards on phones, a table on wider screens. */
export function VariantsEditor({ options, variants, onChange }: Props) {
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");

  const update = (id: string, patch: Partial<EditorVariant>) =>
    onChange(variants.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const colourIndex = options.findIndex((o) => /colou?r/i.test(o.name));
  const swatches = new Map(options[colourIndex]?.values.map((v) => [v.id, v.swatch_hex]) ?? []);

  return (
    <div>
      <div className="mb-4 grid gap-2 border border-line bg-mist p-3 sm:grid-cols-2">
        <BulkField
          label="Set price for all"
          placeholder="0.00"
          inputMode="decimal"
          value={bulkPrice}
          onValue={setBulkPrice}
          onApply={() => {
            onChange(variants.map((v) => ({ ...v, price: bulkPrice })));
            setBulkPrice("");
          }}
        />
        <BulkField
          label="Set stock for all"
          placeholder="0"
          inputMode="numeric"
          value={bulkStock}
          onValue={setBulkStock}
          onApply={() => {
            onChange(variants.map((v) => ({ ...v, on_hand: bulkStock })));
            setBulkStock("");
          }}
        />
      </div>

      {/* Header row (wide screens) */}
      <div className="hidden grid-cols-[minmax(0,1.4fr)_1fr_1fr_0.8fr_1.2fr_auto] gap-2 border-b border-line pb-2 text-xs font-medium text-muted md:grid">
        <span>Variant</span>
        <span>Price</span>
        <span>Compare at</span>
        <span>Stock</span>
        <span>SKU</span>
        <span className="w-12 text-center">On</span>
      </div>

      <ul className="divide-y divide-line">
        {variants.map((v) => {
          const title = variantTitle(options, v);
          const swatch = colourIndex >= 0 ? swatches.get(v.option_value_ids[colourIndex]) : null;
          const fid = (f: string) => `variant-${v.id}-${f}`;
          return (
            <li
              key={v.id}
              className={cn(
                "grid grid-cols-2 gap-2 py-3 md:grid-cols-[minmax(0,1.4fr)_1fr_1fr_0.8fr_1.2fr_auto] md:items-center",
                !v.is_active && "opacity-60",
              )}
            >
              <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-1">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  {swatch && <span className="size-3.5 shrink-0 rounded-full border border-line-strong" style={{ background: swatch }} />}
                  <span className="truncate">{title}</span>
                </span>
                {v.reserved > 0 && <span className="shrink-0 text-xs text-muted">{v.reserved} held for orders</span>}
                <Toggle className="md:hidden" checked={v.is_active} onChange={(on) => update(v.id, { is_active: on })} label={title} />
              </div>
              <Cell label="Price" htmlFor={fid("price")}>
                <Input
                  id={fid("price")}
                  value={v.price}
                  onChange={(e) => update(v.id, { price: e.target.value })}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-10"
                />
              </Cell>
              <Cell label="Compare at" htmlFor={fid("compare")}>
                <Input
                  id={fid("compare")}
                  value={v.compare_at}
                  onChange={(e) => update(v.id, { compare_at: e.target.value })}
                  inputMode="decimal"
                  placeholder="—"
                  className="h-10"
                />
              </Cell>
              <Cell label="Stock" htmlFor={fid("stock")}>
                <Input
                  id={fid("stock")}
                  value={v.on_hand}
                  onChange={(e) => update(v.id, { on_hand: e.target.value.replace(/[^\d]/g, "") })}
                  inputMode="numeric"
                  placeholder="0"
                  className="h-10"
                />
              </Cell>
              <Cell label="SKU" htmlFor={fid("sku")}>
                <Input
                  id={fid("sku")}
                  value={v.sku}
                  onChange={(e) => update(v.id, { sku: e.target.value.toUpperCase() })}
                  placeholder="Optional"
                  maxLength={64}
                  className="h-10"
                  autoCapitalize="characters"
                />
              </Cell>
              <div className="hidden w-12 justify-center md:flex">
                <Toggle checked={v.is_active} onChange={(on) => update(v.id, { is_active: on })} label={title} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Turn a variant off to hide it from the store without losing its stock or history. Sold-out variants stay visible but
        can&apos;t be bought.
      </p>
    </div>
  );
}

function Cell({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs text-muted md:sr-only">
        {label}
      </label>
      {children}
    </div>
  );
}

function BulkField({
  label,
  placeholder,
  inputMode,
  value,
  onValue,
  onApply,
}: {
  label: string;
  placeholder: string;
  inputMode: "decimal" | "numeric";
  value: string;
  onValue: (v: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => onValue(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-label={label}
        className="h-10 bg-paper"
      />
      <Button variant="secondary" size="sm" onClick={onApply} disabled={!value.trim()} className="h-10 shrink-0">
        {label}
      </Button>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label} available`}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors",
        checked ? "bg-ink" : "bg-line-strong",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-paper shadow-sm transition-transform",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}
