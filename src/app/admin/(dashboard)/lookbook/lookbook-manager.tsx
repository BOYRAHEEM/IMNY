"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import { Icon } from "@/components/admin/icons";
import { ImageRejected, prepareImage } from "@/components/admin/product-editor/compress-image";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { SubmitButton } from "@/components/ui/submit-button";
import { ACCEPTED_IMAGE_TYPES, CATALOG_BUCKET } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import { addLookbookImages, deleteLookbookImage, reorderLookbook, updateLookbookImage } from "./actions";

export type Look = { id: string; url: string; label: string | null; alt_text: string | null };

export function LookbookManager({ looks }: { looks: Look[] }) {
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();

  async function upload(files: FileList) {
    const list = Array.from(files).slice(0, 20);
    setErrors([]);
    setUploading(list.length);
    const supabase = createClient();
    const done: { storage_path: string; width: number; height: number }[] = [];
    const problems: string[] = [];
    for (const file of list) {
      try {
        const p = await prepareImage(file);
        const path = `site/lookbook/${crypto.randomUUID()}.${p.ext}`;
        const { error } = await supabase.storage.from(CATALOG_BUCKET).upload(path, p.blob, { contentType: p.blob.type, cacheControl: "31536000" });
        if (error) throw error;
        done.push({ storage_path: path, width: p.width, height: p.height });
      } catch (err) {
        problems.push(err instanceof ImageRejected ? err.message : `${file.name} couldn't be uploaded.`);
      }
      setUploading((n) => n - 1);
    }
    if (done.length) {
      const r = await addLookbookImages(done);
      if (!r.ok) problems.push(r.error);
    }
    setErrors(problems);
  }

  function move(index: number, delta: number) {
    const ids = looks.map((l) => l.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    start(async () => {
      const r = await reorderLookbook(ids);
      if (!r.ok) setErrors([r.error]);
    });
  }

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl border border-bad/25 bg-bad-bg px-3 py-2.5 text-sm text-bad">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-paper px-4 py-8 text-center hover:bg-mist">
        {uploading > 0 ? (
          <span className="flex items-center gap-2 text-sm">
            <Spinner /> Uploading {uploading} photo{uploading === 1 ? "" : "s"}…
          </span>
        ) : (
          <>
            <Icon name="upload" className="mb-2 size-6 text-muted" />
            <span className="text-sm font-medium">Add lookbook photos</span>
            <span className="mt-1 text-xs text-muted">Portrait (3:4) works best · resized automatically</span>
          </>
        )}
        <input
          type="file"
          multiple
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          disabled={uploading > 0}
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {looks.length === 0 ? (
        <EmptyState title="No lookbook photos yet." description="Until you add some, the lookbook page shows placeholders." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {looks.map((look, i) => (
            <LookCard
              key={look.id}
              look={look}
              first={i === 0}
              last={i === looks.length - 1}
              busy={pending}
              onMove={(d) => move(i, d)}
              onDelete={() =>
                start(async () => {
                  const r = await deleteLookbookImage(look.id);
                  if (!r.ok) setErrors([r.error]);
                })
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function LookCard({
  look,
  first,
  last,
  busy,
  onMove,
  onDelete,
}: {
  look: Look;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (delta: number) => void;
  onDelete: () => void;
}) {
  const [result, action] = useActionState(updateLookbookImage, null);
  const [confirm, setConfirm] = useState(false);
  const btn = "flex size-9 items-center justify-center rounded-full text-muted hover:bg-mist disabled:opacity-30";
  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-paper">
      <div className="relative aspect-[3/4] placeholder-stripes">
        <Image src={look.url} alt={look.alt_text ?? ""} fill sizes="(min-width: 1024px) 200px, 45vw" className="object-cover" />
      </div>
      <form action={action} className="space-y-2 p-2">
        <input type="hidden" name="id" value={look.id} />
        <input name="label" defaultValue={look.label ?? ""} placeholder="Label, e.g. LOOK 01 · FULL LENGTH" aria-label="Label" maxLength={80} className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:border-ink focus:outline-none" />
        <input name="alt_text" defaultValue={look.alt_text ?? ""} placeholder="Describe the photo" aria-label="Image description" maxLength={300} className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:border-ink focus:outline-none" />
        <div className="flex items-center justify-between">
          <div className="flex">
            <button type="button" className={btn} onClick={() => onMove(-1)} disabled={first || busy} aria-label="Move earlier">
              <Icon name="left" className="size-4" />
            </button>
            <button type="button" className={btn} onClick={() => onMove(1)} disabled={last || busy} aria-label="Move later">
              <Icon name="right" className="size-4" />
            </button>
            {confirm ? (
              <button type="button" className="ml-1 rounded-lg px-2 text-xs text-bad hover:bg-bad-bg" onClick={onDelete} disabled={busy}>
                Delete?
              </button>
            ) : (
              <button type="button" className={btn} onClick={() => setConfirm(true)} aria-label="Remove photo">
                <Icon name="trash" className="size-4" />
              </button>
            )}
          </div>
          <SubmitButton variant="secondary" size="sm" className="h-8 px-2 text-xs">
            {result?.ok ? "Saved" : "Save"}
          </SubmitButton>
        </div>
        {result && !result.ok && <p className="text-xs text-bad">{result.error}</p>}
      </form>
    </li>
  );
}
