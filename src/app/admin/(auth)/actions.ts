"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { GENERIC_ERROR, logError, type ActionResult } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { safeAdminNext } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

function safeAdminPath(next: FormDataEntryValue | null): string {
  return safeAdminNext(typeof next === "string" ? next : null);
}

const signInSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

export async function adminSignIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: "Enter your email and password." };
  const email = parsed.data.email.toLowerCase();

  const ip = await clientIp();
  const [ipOk, emailOk] = await Promise.all([
    rateLimit(`admin-login:ip:${ip}`, 20, 900),
    rateLimit(`admin-login:email:${email}`, 8, 900),
  ]);
  if (!ipOk || !emailOk) return { ok: false, error: TOO_MANY };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error || !data.user) {
    // Same message whether the email exists or not.
    return { ok: false, error: "Incorrect email or password." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile || (profile.role !== "admin" && profile.role !== "staff")) {
    if (profileError) logError("adminSignIn.profile", profileError);
    await supabase.auth.signOut();
    return { ok: false, error: "This account doesn't have access to the dashboard." };
  }

  redirect(safeAdminPath(formData.get("next")));
}

export async function adminSignOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function requestPasswordReset(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = z.email().max(254).safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  const email = parsed.data.toLowerCase();

  const ip = await clientIp();
  const [ipOk, emailOk] = await Promise.all([
    rateLimit(`pw-reset:ip:${ip}`, 10, 3600),
    rateLimit(`pw-reset:email:${email}`, 3, 3600),
  ]);
  if (!ipOk || !emailOk) return { ok: false, error: TOO_MANY };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/admin/reset-password`,
  });
  if (error) logError("requestPasswordReset", error);

  // Identical response either way, so this can't be used to discover accounts.
  return { ok: true, data: undefined, message: "If that email has an account, a reset link is on its way." };
}

const newPasswordSchema = z
  .object({
    password: z.string().min(10, "Use at least 10 characters.").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The passwords don't match.", path: ["confirm"] });

export async function setNewPassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return { ok: false, error: "This reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logError("setNewPassword", error);
    const weak = error.code === "weak_password" || error.code === "same_password";
    return { ok: false, error: weak ? "Choose a stronger password you haven't used before." : GENERIC_ERROR };
  }
  redirect("/admin");
}
