"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { TAGS } from "@/lib/cache-tags";
import { failure, logError, type ActionResult } from "@/lib/errors";
import { CATALOG_BUCKET } from "@/lib/images";
import { warmImages } from "@/lib/images-warm";
import { createClient } from "@/lib/supabase/server";

async function guard(ctx: string) {
  try {
    await requireStaff();
    return null;
  } catch (err) {
    return failure(`${ctx}.auth`, err);
  }
}

const addSchema = z
  .array(
    z.object({
      storage_path: z.string().regex(/^site\/lookbook\/[A-Za-z0-9_-]+\.(webp|jpg)$/),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
  )
  .min(1)
  .max(20);

export async function addLookbookImages(images: unknown): Promise<ActionResult> {
  const denied = await guard("addLookbookImages");
  if (denied) return denied;
  const parsed = addSchema.safeParse(images);
  if (!parsed.success) return { ok: false, error: "Some images weren't uploaded correctly. Try again." };

  const supabase = await createClient();
  const { data: last } = await supabase.from("lookbook_images").select("position").order("position", { ascending: false }).limit(1);
  const start = (last?.[0]?.position ?? -1) + 1;
  const { error } = await supabase.from("lookbook_images").insert(parsed.data.map((img, i) => ({ ...img, position: start + i })));
  if (error) return failure("addLookbookImages", error);
  warmImages(parsed.data.map((img) => img.storage_path));
  updateTag(TAGS.settings);
  refresh();
  return { ok: true, data: undefined };
}

const updateSchema = z.object({
  id: z.uuid(),
  label: z.string().trim().max(80).transform((v) => v || null),
  alt_text: z.string().trim().max(300).transform((v) => v || null),
});

export async function updateLookbookImage(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const denied = await guard("updateLookbookImage");
  if (denied) return denied;
  const parsed = updateSchema.safeParse({ id: formData.get("id"), label: formData.get("label") ?? "", alt_text: formData.get("alt_text") ?? "" });
  if (!parsed.success) return { ok: false, error: "Check the text and try again." };
  const { id, ...values } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("lookbook_images").update(values).eq("id", id);
  if (error) return failure("updateLookbookImage", error);
  updateTag(TAGS.settings);
  return { ok: true, data: undefined, message: "Saved" };
}

export async function reorderLookbook(ids: unknown): Promise<ActionResult> {
  const denied = await guard("reorderLookbook");
  if (denied) return denied;
  const parsed = z.array(z.uuid()).max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const results = await Promise.all(parsed.data.map((id, position) => supabase.from("lookbook_images").update({ position }).eq("id", id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) return failure("reorderLookbook", failed.error);
  updateTag(TAGS.settings);
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteLookbookImage(id: string): Promise<ActionResult> {
  const denied = await guard("deleteLookbookImage");
  if (denied) return denied;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("lookbook_images").delete().eq("id", id).select("storage_path").maybeSingle();
  if (error) return failure("deleteLookbookImage", error);
  if (data?.storage_path) {
    const { error: rmError } = await supabase.storage.from(CATALOG_BUCKET).remove([data.storage_path]);
    if (rmError) logError("deleteLookbookImage.remove", rmError);
  }
  updateTag(TAGS.settings);
  refresh();
  return { ok: true, data: undefined };
}
