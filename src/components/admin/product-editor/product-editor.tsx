"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteProduct, saveProduct, setProductStatus } from "@/app/admin/(dashboard)/products/actions";
import { Panel } from "@/components/admin/page-header";
import { ProductStatusBadge } from "@/components/admin/status";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { slugify } from "@/lib/slug";
import { ImageManager } from "./image-manager";
import {
  buildPayload,
  combinationCount,
  isColourOption,
  MAX_VARIANTS,
  syncVariants,
  type EditorOption,
  type EditorState,
  type ProductStatus,
} from "./model";
import { OptionsEditor } from "./options-editor";
import { VariantsEditor } from "./variants-editor";

type Props = {
  initial: EditorState;
  categories: { id: string; name: string }[];
  isAdmin: boolean;
  notice?: string;
};

export function ProductEditor({ initial, categories, isAdmin, notice }: Props) {
  const router = useRouter();
  const [s, setS] = useState<EditorState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(notice ?? null);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const snapshot = useMemo(() => JSON.stringify(initial), [initial]);
  const dirty = JSON.stringify(s) !== snapshot;
  const uploading = s.images.some((i) => i.uploading);
  const hasOptions = s.options.length > 0;
  const combos = combinationCount(s.options.filter((o) => o.values.length));
  const tooMany = combos > MAX_VARIANTS;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = (patch: Partial<EditorState>) => setS((prev) => ({ ...prev, ...patch }));

  function setName(name: string) {
    setS((prev) => ({ ...prev, name, slug: prev.slugTouched ? prev.slug : slugify(name) }));
  }

  function setOptions(options: EditorOption[]) {
    setS((prev) => ({ ...prev, options, variants: syncVariants(options, prev.variants, prev.price, prev.compare_at) }));
  }

  /** The main price is the default; variants still on the old default follow it. */
  function setBasePrice(field: "price" | "compare_at", value: string) {
    setS((prev) => ({
      ...prev,
      [field]: value,
      variants: prev.variants.map((v) =>
        prev.options.length === 0 || v[field] === prev[field] || v[field] === "" ? { ...v, [field]: value } : v,
      ),
    }));
  }

  function showError(text: string) {
    setMessage(null);
    setError(text);
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  function save(status: ProductStatus) {
    setError(null);
    if (tooMany) return showError(`That makes ${combos} variants; the limit is ${MAX_VARIANTS}. Remove some option values.`);
    const built = buildPayload(s, status);
    if (!built.ok) return showError(built.error);

    startTransition(async () => {
      const result = await saveProduct(built.payload);
      if (!result.ok) return showError(result.error);
      // Reload from the server so the editor reflects exactly what was saved.
      router.replace(`/admin/products/${s.id}?saved=${status}`, { scroll: false });
      router.refresh();
    });
  }

  function changeStatus(status: ProductStatus, confirmation: string) {
    setError(null);
    startTransition(async () => {
      const result = await setProductStatus(s.id, status);
      if (!result.ok) return showError(result.error);
      set({ status });
      setMessage(confirmation);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteProduct(s.id);
      // On success the action redirects; we only get here on failure.
      if (result && !result.ok) {
        setConfirmDelete(false);
        showError(result.error);
      }
    });
  }

  const onlyVariant = s.variants[0];
  const colourOption = s.options.find((o) => isColourOption(o.name));

  return (
    <div className="pb-24">
      {error && (
        <p ref={errorRef} role="alert" className="mb-4 rounded-2xl border border-bad/25 bg-bad-bg px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}
      {message && !error && (
        <p role="status" className="mb-4 rounded-2xl border border-good/25 bg-good-bg px-4 py-3 text-sm text-good">
          {message}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Details">
            <div className="space-y-4 p-4 sm:p-5">
              <Field label="Product name" htmlFor="name">
                <Input id="name" value={s.name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder="e.g. Premium Linen Dress" />
              </Field>
              <Field label="Description" htmlFor="description" optional hint="Fabric, fit, care instructions. Line breaks are kept.">
                <Textarea
                  id="description"
                  value={s.description}
                  onChange={(e) => set({ description: e.target.value })}
                  maxLength={10000}
                  rows={6}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Photos">
            <div className="p-4 sm:p-5">
              <ImageManager
                productId={s.id}
                productName={s.name || "Product photo"}
                images={s.images}
                primaryId={s.primary_image_id}
                colourValues={colourOption?.values ?? null}
                onChange={(fn) =>
                  setS((prev) => {
                    const next = fn({ images: prev.images, primaryId: prev.primary_image_id });
                    return { ...prev, images: next.images, primary_image_id: next.primaryId };
                  })
                }
              />
            </div>
          </Panel>

          <Panel title="Price">
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <Field label="Price (GHS)" htmlFor="price" hint={hasOptions ? "Default for all variants. You can change each below." : undefined}>
                <Input id="price" value={s.price} onChange={(e) => setBasePrice("price", e.target.value)} inputMode="decimal" placeholder="0.00" />
              </Field>
              <Field label="Compare-at price (GHS)" htmlFor="compare_at" optional hint="Shows as a crossed-out price, for sales.">
                <Input id="compare_at" value={s.compare_at} onChange={(e) => setBasePrice("compare_at", e.target.value)} inputMode="decimal" placeholder="—" />
              </Field>
            </div>
          </Panel>

          <Panel title="Options">
            <div className="p-4 sm:p-5">
              <OptionsEditor options={s.options} onChange={setOptions} />
              {tooMany && (
                <p role="alert" className="mt-3 text-sm text-bad">
                  These options make {combos} combinations. The limit is {MAX_VARIANTS}.
                </p>
              )}
            </div>
          </Panel>

          {hasOptions && !tooMany ? (
            <Panel title={`Variants (${s.variants.length})`}>
              <div className="p-4 sm:p-5">
                {s.variants.length === 0 ? (
                  <p className="text-sm text-muted">Add values to your options to create variants.</p>
                ) : (
                  <VariantsEditor options={s.options} variants={s.variants} onChange={(variants) => set({ variants })} />
                )}
              </div>
            </Panel>
          ) : (
            !hasOptions &&
            onlyVariant && (
              <Panel title="Inventory">
                <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                  <Field
                    label="Quantity in stock"
                    htmlFor="stock"
                    hint={onlyVariant.reserved > 0 ? `${onlyVariant.reserved} held for unpaid orders.` : undefined}
                  >
                    <Input
                      id="stock"
                      value={onlyVariant.on_hand}
                      onChange={(e) =>
                        set({ variants: [{ ...onlyVariant, on_hand: e.target.value.replace(/[^\d]/g, "") }] })
                      }
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="SKU" htmlFor="sku" optional hint="Your internal stock code.">
                    <Input
                      id="sku"
                      value={onlyVariant.sku}
                      onChange={(e) => set({ variants: [{ ...onlyVariant, sku: e.target.value.toUpperCase() }] })}
                      maxLength={64}
                      autoCapitalize="characters"
                    />
                  </Field>
                </div>
              </Panel>
            )
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Status">
            <div className="space-y-3 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <ProductStatusBadge status={s.status} />
                {!s.isNew && s.status === "active" && (
                  <Link href={`/product/${initial.slug}`} target="_blank" className="text-sm text-muted underline underline-offset-4 hover:text-ink">
                    View in store
                  </Link>
                )}
              </div>
              <p className="text-sm text-muted">
                {s.status === "active"
                  ? "Visible to customers."
                  : s.status === "archived"
                    ? "Hidden from the store. Past orders keep their details."
                    : "Only you and your team can see drafts."}
              </p>
            </div>
          </Panel>

          <Panel title="Organisation">
            <div className="space-y-4 p-4 sm:p-5">
              <Field label="Category" htmlFor="category">
                <Select id="category" value={s.category_id} onChange={(e) => set({ category_id: e.target.value })}>
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                {categories.length === 0 && (
                  <p className="mt-1.5 text-xs text-muted">
                    <Link href="/admin/categories" className="underline underline-offset-4">
                      Create categories
                    </Link>{" "}
                    to group products in the shop.
                  </p>
                )}
              </Field>
              <Checkbox
                label="Feature on the home page"
                checked={s.featured}
                onChange={(e) => set({ featured: e.target.checked })}
              />
            </div>
          </Panel>

          <Panel title="Search engines">
            <div className="space-y-4 p-4 sm:p-5">
              <Field label="Web address" htmlFor="slug" hint={`/product/${s.slug || "…"}`}>
                <Input
                  id="slug"
                  value={s.slug}
                  onChange={(e) => set({ slug: slugify(e.target.value) || e.target.value.toLowerCase(), slugTouched: true })}
                  maxLength={200}
                />
              </Field>
              <Field label="Page title" htmlFor="seo_title" optional hint={`${s.seo_title.length}/70 · defaults to the product name`}>
                <Input id="seo_title" value={s.seo_title} onChange={(e) => set({ seo_title: e.target.value })} maxLength={120} />
              </Field>
              <Field label="Meta description" htmlFor="seo_description" optional hint={`${s.seo_description.length}/160`}>
                <Textarea
                  id="seo_description"
                  value={s.seo_description}
                  onChange={(e) => set({ seo_description: e.target.value })}
                  maxLength={320}
                  rows={3}
                  className="min-h-20"
                />
              </Field>
            </div>
          </Panel>

          {!s.isNew && (
            <Panel title="Remove">
              <div className="space-y-3 p-4 sm:p-5">
                {s.status === "archived" ? (
                  <Button variant="secondary" className="w-full" disabled={pending} onClick={() => changeStatus("draft", "Restored as a draft.")}>
                    Restore as draft
                  </Button>
                ) : (
                  <Button variant="secondary" className="w-full" disabled={pending} onClick={() => changeStatus("archived", "Product archived.")}>
                    Archive product
                  </Button>
                )}
                <p className="text-xs text-muted">Archiving hides the product but keeps it for your records.</p>
                {isAdmin &&
                  (confirmDelete ? (
                    <div className="space-y-2 rounded-2xl border border-bad/25 bg-bad-bg p-3">
                      <p className="text-sm text-bad">Delete permanently? Photos are removed too. Past orders keep their details.</p>
                      <div className="flex gap-2">
                        <Button variant="danger" size="sm" disabled={pending} onClick={remove}>
                          Yes, delete
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
                      Delete permanently
                    </Button>
                  ))}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur lg:left-[240px]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <p className="hidden text-sm text-muted sm:block">
            {uploading ? "Uploading photos…" : dirty ? "Unsaved changes" : "All changes saved"}
          </p>
          <div className="flex flex-1 justify-end gap-2 sm:flex-none">
            {s.status === "active" ? (
              <>
                <Button variant="secondary" disabled={pending || uploading} onClick={() => save("draft")} className="flex-1 sm:flex-none">
                  Unpublish
                </Button>
                <Button disabled={pending || uploading} onClick={() => save("active")} className="flex-1 sm:flex-none">
                  {pending && <Spinner />} Save
                </Button>
              </>
            ) : s.status === "archived" ? (
              <Button disabled={pending || uploading} onClick={() => save("archived")} className="flex-1 sm:flex-none">
                {pending && <Spinner />} Save
              </Button>
            ) : (
              <>
                <Button variant="secondary" disabled={pending || uploading} onClick={() => save("draft")} className="flex-1 sm:flex-none">
                  Save draft
                </Button>
                <Button disabled={pending || uploading} onClick={() => save("active")} className="flex-1 sm:flex-none">
                  {pending && <Spinner />} Publish
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
