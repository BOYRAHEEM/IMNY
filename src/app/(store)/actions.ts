"use server";

import { z } from "zod";
import { escapeHtml, sendEmail } from "@/lib/email/send";
import { GENERIC_ERROR, logError } from "@/lib/errors";
import { getStoreSettings } from "@/lib/queries/settings";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

export async function subscribeNewsletter(_prev: Result | null, formData: FormData): Promise<Result> {
  // Bots fill every field; people never see this one.
  if (formData.get("company")) return { ok: true };

  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, error: "enter a valid email." };

  if (!(await rateLimit(`newsletter:${await clientIp()}`, 10, 3600))) {
    return { ok: false, error: "too many tries. give it a minute." };
  }

  const { error } = await createServiceClient()
    .from("newsletter_subscribers")
    .upsert({ email: parsed.data, source: "footer" }, { onConflict: "email", ignoreDuplicates: true });
  if (error) {
    logError("subscribeNewsletter", error);
    return { ok: false, error: GENERIC_ERROR.toLowerCase() };
  }
  return { ok: true };
}

const contactSchema = z.object({
  email,
  message: z.string().trim().min(2, "write a message first.").max(4000, "keep it under 4,000 characters."),
});

export async function sendContactMessage(_prev: Result | null, formData: FormData): Promise<Result> {
  if (formData.get("company")) return { ok: true };

  const parsed = contactSchema.safeParse({ email: formData.get("email"), message: formData.get("message") });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.path[0] === "email" ? "enter a valid email." : issue?.message ?? "check your message." };
  }

  const ip = await clientIp();
  const [ipOk, emailOk] = await Promise.all([
    rateLimit(`contact:ip:${ip}`, 5, 3600),
    rateLimit(`contact:email:${parsed.data.email}`, 5, 3600),
  ]);
  if (!ipOk || !emailOk) return { ok: false, error: "too many messages. try again later." };

  const { error } = await createServiceClient().from("contact_messages").insert(parsed.data);
  if (error) {
    logError("sendContactMessage", error);
    return { ok: false, error: GENERIC_ERROR.toLowerCase() };
  }

  // Also forward to the store inbox if email is set up (never blocks the reply).
  const settings = await getStoreSettings();
  if (settings.contact_email) {
    await sendEmail({
      to: settings.contact_email,
      replyTo: parsed.data.email,
      subject: `New message from ${parsed.data.email}`,
      text: parsed.data.message,
      html: `<p><strong>${escapeHtml(parsed.data.email)}</strong> wrote:</p><p style="white-space:pre-line">${escapeHtml(parsed.data.message)}</p>`,
    });
  }
  return { ok: true };
}
