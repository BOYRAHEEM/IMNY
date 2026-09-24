"use client";

import { useState } from "react";
import { Icon } from "@/components/admin/icons";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { isColourOption, isSizeOption, MAX_OPTIONS, newId, type EditorOption } from "./model";

const SIZE_PRESETS = [
  { label: "XS – XXL", values: ["XS", "S", "M", "L", "XL", "XXL"] },
  { label: "S – XL", values: ["S", "M", "L", "XL"] },
  { label: "UK 6 – 16", values: ["6", "8", "10", "12", "14", "16"] },
];

const COMMON_COLOURS: Record<string, string> = {
  black: "#111111",
  white: "#FFFFFF",
  cream: "#F3EBDD",
  beige: "#D9C7A7",
  brown: "#6B4A33",
  grey: "#8C8C8C",
  gray: "#8C8C8C",
  navy: "#1F2A44",
  blue: "#2F5FA7",
  green: "#3C6E47",
  olive: "#6B6B3A",
  red: "#B3261E",
  pink: "#E8A9B8",
  purple: "#6C4A8E",
  yellow: "#E9C84A",
  orange: "#E07B2E",
};

export function OptionsEditor({ options, onChange }: { options: EditorOption[]; onChange: (options: EditorOption[]) => void }) {
  const update = (id: string, patch: Partial<EditorOption>) =>
    onChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const addOption = (name: string) => onChange([...options, { id: newId(), name, values: [] }]);

  const used = new Set(options.map((o) => o.name.toLowerCase()));

  return (
    <div className="space-y-4">
      {options.length === 0 && (
        <p className="text-sm text-muted">
          Does this product come in different sizes, colours or styles? Add them as options and a variant is created for each
          combination. Leave this empty for one-size items.
        </p>
      )}

      {options.map((option, index) => (
        <OptionCard
          key={option.id}
          option={option}
          index={index}
          onChange={(patch) => update(option.id, patch)}
          onRemove={() => onChange(options.filter((o) => o.id !== option.id))}
        />
      ))}

      {options.length < MAX_OPTIONS && (
        <div className="flex flex-wrap gap-2">
          {!used.has("size") && (
            <Button variant="secondary" size="sm" onClick={() => addOption("Size")}>
              <Icon name="plus" className="size-4" /> Size
            </Button>
          )}
          {!used.has("colour") && !used.has("color") && (
            <Button variant="secondary" size="sm" onClick={() => addOption("Colour")}>
              <Icon name="plus" className="size-4" /> Colour
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => addOption("")}>
            <Icon name="plus" className="size-4" /> Other option
          </Button>
        </div>
      )}
    </div>
  );
}

function OptionCard({
  option,
  index,
  onChange,
  onRemove,
}: {
  option: EditorOption;
  index: number;
  onChange: (patch: Partial<EditorOption>) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState("");
  const colour = isColourOption(option.name);
  const size = isSizeOption(option.name);

  function addValues(raw: string[]) {
    const existing = new Set(option.values.map((v) => v.value.toLowerCase()));
    const additions = raw
      .map((s) => s.trim())
      .filter((s) => s && s.length <= 40)
      .filter((s) => {
        const k = s.toLowerCase();
        if (existing.has(k)) return false;
        existing.add(k);
        return true;
      })
      .map((value) => ({ id: newId(), value, swatch_hex: colour ? (COMMON_COLOURS[value.toLowerCase()] ?? null) : null }));
    if (additions.length) onChange({ values: [...option.values, ...additions].slice(0, 50) });
  }

  function commitDraft() {
    if (!draft.trim()) return;
    addValues(draft.split(","));
    setDraft("");
  }

  const nameId = `option-${option.id}-name`;
  const valueId = `option-${option.id}-value`;

  return (
    <div className="rounded-2xl border border-line p-3 sm:p-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor={nameId}>Option {index + 1}</Label>
          <Input
            id={nameId}
            value={option.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Size, Colour, Length"
            maxLength={40}
            list="option-name-suggestions"
          />
          <datalist id="option-name-suggestions">
            <option value="Size" />
            <option value="Colour" />
            <option value="Length" />
            <option value="Fit" />
            <option value="Material" />
            <option value="Style" />
          </datalist>
        </div>
        <Button variant="ghost" onClick={onRemove} aria-label={`Remove option ${option.name || index + 1}`}>
          <Icon name="trash" className="size-4" />
        </Button>
      </div>

      <div className="mt-3">
        <Label htmlFor={valueId}>Values</Label>
        {option.values.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2">
            {option.values.map((v) => (
              <li key={v.id} className="flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-paper pr-1 pl-3 text-sm">
                {colour && (
                  <label className="relative size-5 shrink-0 cursor-pointer overflow-hidden rounded-full border border-line-strong" title="Pick swatch colour">
                    <span className="absolute inset-0" style={{ background: v.swatch_hex ?? "transparent" }} />
                    <input
                      type="color"
                      value={v.swatch_hex ?? "#cccccc"}
                      onChange={(e) =>
                        onChange({
                          values: option.values.map((x) => (x.id === v.id ? { ...x, swatch_hex: e.target.value.toUpperCase() } : x)),
                        })
                      }
                      className="absolute inset-0 cursor-pointer opacity-0"
                      aria-label={`Swatch colour for ${v.value}`}
                    />
                  </label>
                )}
                <input
                  value={v.value}
                  onChange={(e) =>
                    onChange({ values: option.values.map((x) => (x.id === v.id ? { ...x, value: e.target.value } : x)) })
                  }
                  aria-label={`Rename ${v.value}`}
                  className="min-w-8 bg-transparent focus:outline-none"
                  style={{ width: `${Math.max(v.value.length, 2) + 1}ch` }}
                  maxLength={40}
                />
                <button
                  type="button"
                  onClick={() => onChange({ values: option.values.filter((x) => x.id !== v.id) })}
                  className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink"
                  aria-label={`Remove ${v.value}`}
                >
                  <Icon name="close" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            id={valueId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commitDraft();
              }
            }}
            onBlur={commitDraft}
            placeholder={colour ? "e.g. Black" : size ? "e.g. M" : "Add a value"}
            enterKeyHint="done"
          />
          <Button variant="secondary" onClick={commitDraft} disabled={!draft.trim()}>
            Add
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted">Press Enter or comma after each value. You can type several at once: S, M, L</p>

        {size && option.values.length === 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Quick add:</span>
            {SIZE_PRESETS.map((p) => (
              <Button key={p.label} variant="secondary" size="sm" onClick={() => addValues(p.values)}>
                {p.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
