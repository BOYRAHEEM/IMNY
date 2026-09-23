"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { TAGS } from "@/lib/cache-tags";
import { failure, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  variant_id: z.uuid(),
  on_hand: z.coerce.number().int("Stock must be a whole number.").min(0, "Stock can't be negative.").max(1_000_000),
});

export async function updateStock(_prev: ActionResult<{ on_hand: number }> | null, formData: FormData): Promise<ActionResult<{ on_hand: number }>> {
  try {
    await requireStaff();
  } catch (err) {
    return failure("updateStock.auth", err);
  }
  const parsed = schema.safeParse({ variant_id: formData.get("variant_id"), on_hand: formData.get("on_hand") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid number." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_inventory_level", {
    p_variant_id: parsed.data.variant_id,
    p_on_hand: parsed.data.on_hand,
    p_note: "Inventory page",
  });
  if (error) return failure("updateStock", error);

  updateTag(TAGS.catalog);
  return { ok: true, data: { on_hand: data ?? parsed.data.on_hand }, message: "Saved" };
}
