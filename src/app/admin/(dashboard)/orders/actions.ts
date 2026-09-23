"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { TAGS } from "@/lib/cache-tags";
import { sendOrderShipped } from "@/lib/email/order-confirmation";
import { failure, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

const note = z
  .string()
  .trim()
  .max(2000)
  .transform((v) => v || null);

const statusSchema = z.object({
  order_id: z.uuid(),
  status: z.enum(["confirmed", "processing", "ready", "shipped", "delivered", "cancelled"]),
  note,
  restock: z.boolean(),
});

export async function updateOrderStatus(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch (err) {
    return failure("updateOrderStatus.auth", err);
  }
  const parsed = statusSchema.safeParse({
    order_id: formData.get("order_id"),
    status: formData.get("status"),
    note: formData.get("note") ?? "",
    restock: formData.get("restock") === "on",
  });
  if (!parsed.success) return { ok: false, error: "Choose a status." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_order_status", {
    p_order_id: parsed.data.order_id,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? undefined,
    p_restock: parsed.data.restock,
  });
  if (error) return failure("updateOrderStatus", error);

  // Cancelling can return stock to the shelf.
  if (parsed.data.status === "cancelled") updateTag(TAGS.stock);
  if (parsed.data.status === "shipped") await sendOrderShipped(parsed.data.order_id);
  refresh();
  return { ok: true, data: undefined, message: parsed.data.status === "cancelled" ? "Order cancelled." : "Status updated." };
}

const noteSchema = z.object({ order_id: z.uuid(), body: z.string().trim().min(1, "Write a note first.").max(2000) });

export async function addOrderNote(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch (err) {
    return failure("addOrderNote.auth", err);
  }
  const parsed = noteSchema.safeParse({ order_id: formData.get("order_id"), body: formData.get("body") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid note." };

  const supabase = await createClient();
  const { error } = await supabase.from("order_notes").insert(parsed.data);
  if (error) return failure("addOrderNote", error);
  refresh();
  return { ok: true, data: undefined, message: "Note added." };
}

const idNoteSchema = z.object({ order_id: z.uuid(), note });

export async function markOrderRefunded(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireStaff({ adminOnly: true });
  } catch (err) {
    return failure("markOrderRefunded.auth", err);
  }
  const parsed = idNoteSchema.safeParse({ order_id: formData.get("order_id"), note: formData.get("note") ?? "" });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_mark_refunded", {
    p_order_id: parsed.data.order_id,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return failure("markOrderRefunded", error);
  refresh();
  return { ok: true, data: undefined, message: "Marked as refunded." };
}

export async function recordCashPayment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch (err) {
    return failure("recordCashPayment.auth", err);
  }
  const parsed = idNoteSchema.safeParse({ order_id: formData.get("order_id"), note: formData.get("note") ?? "" });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_record_cod_payment", {
    p_order_id: parsed.data.order_id,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return failure("recordCashPayment", error);
  refresh();
  return { ok: true, data: undefined, message: "Cash payment recorded." };
}

export async function resolveAttention(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch (err) {
    return failure("resolveAttention.auth", err);
  }
  const parsed = idNoteSchema.safeParse({ order_id: formData.get("order_id"), note: formData.get("note") ?? "" });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_resolve_attention", {
    p_order_id: parsed.data.order_id,
    p_note: parsed.data.note ?? "Resolved",
  });
  if (error) return failure("resolveAttention", error);
  refresh();
  return { ok: true, data: undefined, message: "Marked as resolved." };
}
