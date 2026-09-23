"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { failure, type ActionResult } from "@/lib/errors";
import { parseMoneyInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

/** "2026-10-01T09:00" from <input type="datetime-local">, interpreted in Accra time (UTC+0). */
const localDate = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : `${v}Z`);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return d.toISOString();
  });

const optionalInt = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) {
      ctx.addIssue({ code: "custom", message: "Limits must be whole numbers of 1 or more." });
      return z.NEVER;
    }
    return n;
  });

const schema = z
  .object({
    id: z.uuid().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,32}$/, "Codes are 3-32 letters, numbers, dashes or underscores."),
    description: z
      .string()
      .trim()
      .max(200)
      .transform((v) => v || null),
    type: z.enum(["percentage", "fixed"]),
    value: z.string().trim(),
    max_discount: z.string().trim(),
    min_order: z.string().trim(),
    starts_at: localDate,
    expires_at: localDate,
    usage_limit: optionalInt,
    per_customer_limit: optionalInt,
    is_active: z.boolean(),
  })
  .transform((d, ctx) => {
    let value: number;
    if (d.type === "percentage") {
      value = Number(d.value);
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        ctx.addIssue({ code: "custom", message: "Percentage must be a whole number from 1 to 100." });
        return z.NEVER;
      }
    } else {
      const minor = parseMoneyInput(d.value);
      if (minor === null || Number.isNaN(minor) || minor < 1) {
        ctx.addIssue({ code: "custom", message: "Enter the discount amount in GHS." });
        return z.NEVER;
      }
      value = minor;
    }
    const max = parseMoneyInput(d.max_discount);
    const min = parseMoneyInput(d.min_order);
    if (Number.isNaN(max) || Number.isNaN(min)) {
      ctx.addIssue({ code: "custom", message: "Amounts must be numbers, like 50 or 50.00." });
      return z.NEVER;
    }
    if (d.starts_at && d.expires_at && d.expires_at <= d.starts_at) {
      ctx.addIssue({ code: "custom", message: "The end date must be after the start date." });
      return z.NEVER;
    }
    return {
      id: d.id,
      row: {
        code: d.code,
        description: d.description,
        type: d.type,
        value,
        max_discount_minor: d.type === "percentage" ? max || null : null,
        min_order_minor: min ?? 0,
        starts_at: d.starts_at,
        expires_at: d.expires_at,
        usage_limit: d.usage_limit,
        per_customer_limit: d.per_customer_limit,
        is_active: d.is_active,
      },
    };
  });

export async function saveDiscount(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireStaff({ adminOnly: true });
  } catch (err) {
    return failure("saveDiscount.auth", err);
  }
  const f = (k: string) => (formData.get(k) as string | null) ?? "";
  const parsed = schema.safeParse({
    id: f("id") || undefined,
    code: f("code"),
    description: f("description"),
    type: f("type"),
    value: f("value"),
    max_discount: f("max_discount"),
    min_order: f("min_order"),
    starts_at: f("starts_at"),
    expires_at: f("expires_at"),
    usage_limit: f("usage_limit"),
    per_customer_limit: f("per_customer_limit"),
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };

  const supabase = await createClient();
  const { id, row } = parsed.data;
  const { error } = id ? await supabase.from("discount_codes").update(row).eq("id", id) : await supabase.from("discount_codes").insert(row);
  if (error) return failure("saveDiscount", error);
  redirect("/admin/discounts?saved=1");
}

export async function deleteDiscount(id: string): Promise<ActionResult> {
  try {
    await requireStaff({ adminOnly: true });
  } catch (err) {
    return failure("deleteDiscount.auth", err);
  }
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { data: code } = await supabase.from("discount_codes").select("usage_count").eq("id", id).maybeSingle();
  if (!code) return { ok: false, error: "That discount no longer exists." };
  if (code.usage_count > 0) {
    return { ok: false, error: "This code has been used, so it can't be deleted. Turn it off instead to keep your order history complete." };
  }
  const { error } = await supabase.from("discount_codes").delete().eq("id", id);
  if (error) return failure("deleteDiscount", error);
  redirect("/admin/discounts?deleted=1");
}
