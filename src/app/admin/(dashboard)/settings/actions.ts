"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { TAGS } from "@/lib/cache-tags";
import { failure, type ActionResult } from "@/lib/errors";
import { parseMoneyInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { revalidateStore } from "@/lib/revalidate-store";
import { ensureInvited } from "@/lib/team";

async function requireAdmin(context: string): Promise<{ ok: false; error: string } | null> {
  try {
    await requireStaff({ adminOnly: true });
    return null;
  } catch (err) {
    return failure(`${context}.auth`, err);
  }
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const url = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Social links must start with https://")
  .transform((v) => v || null);

const moneyOrNull = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = parseMoneyInput(v);
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: "Amounts must be numbers, like 500 or 500.00." });
      return z.NEVER;
    }
    return n;
  });

const settingsSchema = z.object({
  store_name: z.string().trim().min(1, "Enter your store name.").max(80),
  tagline: text(160),
  contact_email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid contact email.")
    .transform((v) => v || null),
  contact_phone: text(32),
  whatsapp_number: text(32),
  business_address: text(300),
  announcement: text(200),
  order_prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/, "Order prefix: 1-6 letters or numbers."),
  low_stock_threshold: z.coerce.number().int().min(0).max(1000),
  reservation_minutes: z.coerce.number().int().min(5, "Hold stock for at least 5 minutes.").max(240),
  max_quantity_per_item: z.coerce.number().int().min(1).max(100),
  free_delivery_over_minor: moneyOrNull,
  allow_guest_checkout: z.boolean(),
  seo_title: text(120),
  seo_description: text(320),
  instagram: url,
  tiktok: url,
  facebook: url,
  x: url,
});

export async function saveSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const denied = await requireAdmin("saveSettings");
  if (denied) return denied;

  const f = (k: string) => (formData.get(k) as string | null) ?? "";
  const parsed = settingsSchema.safeParse({
    ...Object.fromEntries(
      [
        "store_name", "tagline", "contact_email", "contact_phone", "whatsapp_number", "business_address", "announcement",
        "order_prefix", "low_stock_threshold", "reservation_minutes", "max_quantity_per_item", "free_delivery_over_minor",
        "seo_title", "seo_description", "instagram", "tiktok", "facebook", "x",
      ].map((k) => [k, f(k)]),
    ),
    allow_guest_checkout: formData.get("allow_guest_checkout") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };

  const { instagram, tiktok, facebook, x, ...rest } = parsed.data;
  const social_links = Object.fromEntries(Object.entries({ instagram, tiktok, facebook, x }).filter(([, v]) => v));

  const supabase = await createClient();
  const { error } = await supabase.from("store_settings").update({ ...rest, social_links }).eq("id", true);
  if (error) return failure("saveSettings", error);

  updateTag(TAGS.settings);
  refresh();
  return { ok: true, data: undefined, message: "Settings saved." };
}

const zoneSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Name the delivery zone.").max(80),
  description: text(300),
  fee: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = parseMoneyInput(v);
      if (n === null || Number.isNaN(n)) {
        ctx.addIssue({ code: "custom", message: "Enter the delivery fee in GHS (0 for free)." });
        return z.NEVER;
      }
      return n;
    }),
  free_over: moneyOrNull,
  estimated_days: text(40),
  sort_order: z.coerce.number().int().min(-1000).max(1000),
  is_active: z.boolean(),
});

export async function saveZone(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const denied = await requireAdmin("saveZone");
  if (denied) return denied;

  const f = (k: string) => (formData.get(k) as string | null) ?? "";
  const parsed = zoneSchema.safeParse({
    id: f("id") || undefined,
    name: f("name"),
    description: f("description"),
    fee: f("fee"),
    free_over: f("free_over"),
    estimated_days: f("estimated_days"),
    sort_order: f("sort_order") || 0,
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };

  const { id, fee, free_over, ...rest } = parsed.data;
  const row = { ...rest, fee_minor: fee, free_over_minor: free_over };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("delivery_zones").update(row).eq("id", id) : await supabase.from("delivery_zones").insert(row);
  if (error) return failure("saveZone", error);

  updateTag(TAGS.settings);
  redirect("/admin/settings?zone=saved#delivery");
}

export async function deleteZone(id: string): Promise<ActionResult> {
  const denied = await requireAdmin("deleteZone");
  if (denied) return denied;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  // Past orders keep the zone name they were delivered to.
  const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
  if (error) return failure("deleteZone", error);
  updateTag(TAGS.settings);
  redirect("/admin/settings?zone=deleted#delivery");
}

export async function refreshStorefront(): Promise<ActionResult> {
  const denied = await requireAdmin("refreshStorefront");
  if (denied) return denied;
  revalidateStore();
  return { ok: true, data: undefined, message: "The store now shows the latest data." };
}

const teamSchema = z.object({
  email: z.email("Enter a valid email address.").max(254),
  role: z.enum(["staff", "admin"]),
});

export async function addTeamMember(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const denied = await requireAdmin("addTeamMember");
  if (denied) return denied;
  const parsed = teamSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  let invited = false;
  try {
    ({ invited } = await ensureInvited(parsed.data.email));
  } catch (err) {
    return failure("addTeamMember.invite", err);
  }

  // The role is granted through the admin-checked database function.
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role_by_email", { p_email: parsed.data.email, p_role: parsed.data.role });
  if (error) return failure("addTeamMember", error);
  refresh();
  const role = parsed.data.role === "admin" ? "an admin" : "staff";
  return {
    ok: true,
    data: undefined,
    message: invited
      ? `Invitation sent to ${parsed.data.email}. They'll join as ${role} once they set a password.`
      : `${parsed.data.email} is now ${role}.`,
  };
}

const roleSchema = z.object({ user_id: z.uuid(), role: z.enum(["customer", "staff", "admin"]) });

export async function changeTeamRole(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const denied = await requireAdmin("changeTeamRole");
  if (denied) return denied;
  const parsed = roleSchema.safeParse({ user_id: formData.get("user_id"), role: formData.get("role") });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", { p_user_id: parsed.data.user_id, p_role: parsed.data.role });
  if (error) return failure("changeTeamRole", error);
  refresh();
  return { ok: true, data: undefined, message: parsed.data.role === "customer" ? "Access removed." : "Role updated." };
}
