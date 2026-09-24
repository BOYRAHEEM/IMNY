"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Icon } from "@/components/admin/icons";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { ACCEPTED_IMAGE_TYPES, CATALOG_BUCKET, catalogImageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import { ImageRejected, prepareImage } from "./compress-image";
import { newId, type EditorImage, type EditorValue } from "./model";

const MAX_IMAGES = 20;

type Props = {
  productId: string;
  productName: string;
  images: EditorImage[];
  primaryId: string | null;
  colourValues: EditorValue[] | null;
  onChange: (update: (prev: { images: EditorImage[]; primaryId: string | null }) => { images: EditorImage[]; primaryId: string | null }) => void;
};

export function ImageManager({ productId, productName, images, primaryId, colourValues, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const cover = primaryId && images.some((i) => i.id === primaryId) ? primaryId : images[0]?.id;

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const room = MAX_IMAGES - images.length;
    const newErrors: string[] = [];
    if (list.length > room) newErrors.push(`Only ${MAX_IMAGES} images per product. ${list.length - room} not added.`);
    const accepted = list.slice(0, Math.max(0, room));

    // Show placeholders immediately so the admin sees progress.
    const pending = accepted.map((file) => ({
      file,
      image: {
        id: newId(),
        storage_path: "",
        alt_text: "",
        option_value_id: null,
        width: null,
        height: null,
        url: URL.createObjectURL(file),
        uploading: true,
      } satisfies EditorImage,
    }));
    onChange((prev) => ({ ...prev, images: [...prev.images, ...pending.map((p) => p.image)] }));

    const supabase = createClient();
    // Two at a time: fast on Wi-Fi, gentle on mobile data.
    const queue = [...pending];
    await Promise.all(
      Array.from({ length: Math.min(2, queue.length) }, async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
          const { file, image } = item;
          try {
            const prepared = await prepareImage(file);
            const path = `products/${productId}/${image.id}.${prepared.ext}`;
            const { error } = await supabase.storage.from(CATALOG_BUCKET).upload(path, prepared.blob, {
              contentType: prepared.blob.type,
              cacheControl: "31536000",
              upsert: false,
            });
            if (error) throw error;
            onChange((prev) => ({
              ...prev,
              images: prev.images.map((i) =>
                i.id === image.id
                  ? { ...i, storage_path: path, width: prepared.width, height: prepared.height, url: catalogImageUrl(path)!, uploading: false }
                  : i,
              ),
            }));
          } catch (err) {
            newErrors.push(
              err instanceof ImageRejected ? err.message : `${file.name} couldn't be uploaded. Check your connection and try again.`,
            );
            if (!(err instanceof ImageRejected)) console.error("[imageUpload]", err);
            onChange((prev) => ({ ...prev, images: prev.images.filter((i) => i.id !== image.id) }));
          } finally {
            URL.revokeObjectURL(image.url);
          }
        }
      }),
    );
    setErrors(newErrors);
  }

  function move(index: number, delta: number) {
    onChange((prev) => {
      const next = [...prev.images];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, images: next };
    });
  }

  function remove(id: string) {
    onChange((prev) => ({
      images: prev.images.filter((i) => i.id !== id),
      primaryId: prev.primaryId === id ? null : prev.primaryId,
    }));
  }

  function update(id: string, patch: Partial<EditorImage>) {
    onChange((prev) => ({ ...prev, images: prev.images.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }

  return (
    <div>
      {errors.length > 0 && (
        <ul role="alert" className="mb-4 space-y-1 rounded-xl border border-bad/25 bg-bad-bg px-3 py-2.5 text-sm text-bad">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {images.length > 0 && (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, index) => (
            <li key={img.id} className="overflow-hidden rounded-2xl border border-line bg-paper">
              <div className="relative aspect-[4/5] placeholder-stripes">
                <Image
                  src={img.url}
                  alt={img.alt_text || productName}
                  fill
                  sizes="(min-width: 1024px) 180px, 45vw"
                  className={cn("object-cover", img.uploading && "opacity-50")}
                  unoptimized={img.uploading}
                />
                {img.uploading && (
                  <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-ink">
                    <Spinner /> Uploading
                  </span>
                )}
                {img.id === cover && !img.uploading && (
                  <Badge tone="dark" className="absolute top-2 left-2">
                    Cover
                  </Badge>
                )}
              </div>
              {!img.uploading && (
                <div className="space-y-2 p-2">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex">
                      <IconButton label="Move earlier" icon="left" onClick={() => move(index, -1)} disabled={index === 0} />
                      <IconButton label="Move later" icon="right" onClick={() => move(index, 1)} disabled={index === images.length - 1} />
                    </div>
                    <div className="flex">
                      <IconButton
                        label={img.id === cover ? "This is the cover image" : "Make cover image"}
                        icon="star"
                        onClick={() => onChange((prev) => ({ ...prev, primaryId: img.id }))}
                        pressed={img.id === cover}
                      />
                      <IconButton label="Remove image" icon="trash" onClick={() => remove(img.id)} />
                    </div>
                  </div>
                  <input
                    value={img.alt_text}
                    onChange={(e) => update(img.id, { alt_text: e.target.value })}
                    placeholder="Describe this photo"
                    aria-label="Image description (alt text)"
                    maxLength={300}
                    className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:border-ink focus:outline-none"
                  />
                  {colourValues && colourValues.length > 0 && (
                    <select
                      value={img.option_value_id ?? ""}
                      onChange={(e) => update(img.id, { option_value_id: e.target.value || null })}
                      aria-label="Colour shown in this photo"
                      className="h-9 w-full rounded-lg border border-line bg-paper px-2 text-xs focus:border-ink focus:outline-none"
                    >
                      <option value="">All colours</option>
                      {colourValues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.value}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {images.length < MAX_IMAGES && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-8 text-center transition-colors",
            dragOver ? "border-ink bg-mist" : "border-line-strong hover:bg-mist",
          )}
        >
          <Icon name="upload" className="mb-2 size-6 text-muted" />
          <span className="text-sm font-medium">{images.length ? "Add more photos" : "Add photos"}</span>
          <span className="mt-1 text-xs text-muted">JPG, PNG or WebP · up to 20 photos · resized automatically</span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

function IconButton({
  label,
  icon,
  onClick,
  disabled,
  pressed,
}: {
  label: string;
  icon: "left" | "right" | "star" | "trash";
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-full hover:bg-mist disabled:opacity-30",
        pressed ? "text-ink" : "text-muted",
      )}
    >
      <Icon name={icon} className={cn("size-4", pressed && "fill-current")} />
    </button>
  );
}
