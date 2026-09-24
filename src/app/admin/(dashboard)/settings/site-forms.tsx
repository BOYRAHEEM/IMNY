"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { ImageRejected, prepareImage } from "@/components/admin/product-editor/compress-image";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { SubmitButton } from "@/components/ui/submit-button";
import { CONTENT_FIELDS, DEFAULT_CONTENT, type SiteContent } from "@/content/site";
import { ACCEPTED_IMAGE_TYPES, CATALOG_BUCKET } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import { saveContent, saveSiteImage } from "./actions";

export function ContentForm({ content }: { content: SiteContent }) {
  const [result, action] = useActionState(saveContent, null);
  const groups = [...new Set(CONTENT_FIELDS.map((f) => f.group))];

  return (
    <form action={action} className="divide-y divide-line">
      <div className="p-4 sm:p-5">
        <FormMessage result={result} />
        <p className="text-sm text-muted">Leave a box empty to use the original wording from the design.</p>
      </div>
      {groups.map((group) => (
        <fieldset key={group} className="space-y-4 p-4 sm:p-5">
          <legend className="mb-2 text-sm font-semibold">{group}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {CONTENT_FIELDS.filter((f) => f.group === group).map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`c-${f.key}`} hint={f.hint} className={f.long ? "sm:col-span-2" : undefined}>
                {f.long ? (
                  <Textarea id={`c-${f.key}`} name={f.key} defaultValue={content[f.key]} placeholder={DEFAULT_CONTENT[f.key]} maxLength={1500} rows={3} className="min-h-20" />
                ) : (
                  <Input id={`c-${f.key}`} name={f.key} defaultValue={content[f.key]} placeholder={DEFAULT_CONTENT[f.key]} maxLength={200} />
                )}
              </Field>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="p-4 sm:p-5">
        <SubmitButton pendingText="Saving…">Save page text</SubmitButton>
      </div>
    </form>
  );
}

export function SiteImageField({
  field,
  folder,
  label,
  hint,
  currentUrl,
}: {
  field: "hero_image_path" | "about_image_path";
  folder: "hero" | "about";
  label: string;
  hint: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    try {
      const prepared = await prepareImage(file);
      const path = `site/${folder}/${crypto.randomUUID()}.${prepared.ext}`;
      const { error: upError } = await createClient()
        .storage.from(CATALOG_BUCKET)
        .upload(path, prepared.blob, { contentType: prepared.blob.type, cacheControl: "31536000", upsert: false });
      if (upError) throw upError;
      const result = await saveSiteImage(field, path);
      if (!result.ok) setError(result.error);
      else router.refresh();
    } catch (err) {
      setError(err instanceof ImageRejected ? err.message : "The image couldn't be uploaded. Check your connection and try again.");
      if (!(err instanceof ImageRejected)) console.error("[siteImage]", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <p className="mb-3 text-sm text-muted">{hint}</p>
      <div className="flex items-start gap-4">
        <div className="relative aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-xl placeholder-stripes">
          {currentUrl ? (
            <Image src={currentUrl} alt="" fill sizes="112px" className="object-cover" />
          ) : (
            <span className="placeholder-stripes absolute inset-0" />
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-paper/70">
              <Spinner />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center rounded-full border border-ink px-4 font-mono text-xs font-semibold tracking-[0.06em] hover:bg-lime">
            {currentUrl ? "Replace photo" : "Upload photo"}
            <input
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
          </label>
          {currentUrl && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending || busy}
              onClick={() =>
                start(async () => {
                  const r = await saveSiteImage(field, null);
                  if (!r.ok) setError(r.error);
                  else router.refresh();
                })
              }
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
