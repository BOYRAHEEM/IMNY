"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { failure, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export async function setMessageHandled(id: string, handled: boolean): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch (err) {
    return failure("setMessageHandled.auth", err);
  }
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({ handled, handled_at: handled ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return failure("setMessageHandled", error);
  refresh();
  return { ok: true, data: undefined };
}

export async function removeSubscriber(id: string): Promise<ActionResult> {
  try {
    await requireStaff({ adminOnly: true });
  } catch (err) {
    return failure("removeSubscriber.auth", err);
  }
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.from("newsletter_subscribers").delete().eq("id", id);
  if (error) return failure("removeSubscriber", error);
  refresh();
  return { ok: true, data: undefined };
}
