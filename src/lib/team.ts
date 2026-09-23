import "server-only";
import { publicEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/admin";

export const INVITE_REDIRECT = () =>
  `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=${encodeURIComponent("/admin/reset-password?welcome=1")}`;

/**
 * Make sure an account exists for this email, sending an invitation email if
 * it's new. Returns whether an invite was sent. Callers must already have
 * checked that the current user is an admin; the role itself is granted
 * separately through the admin-checked database function.
 */
export async function ensureInvited(email: string): Promise<{ invited: boolean }> {
  const admin = createServiceClient();
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (existing) return { invited: false };

  const { error } = await admin.auth.admin.inviteUserByEmail(email.toLowerCase(), { redirectTo: INVITE_REDIRECT() });
  if (error) throw error;
  return { invited: true };
}
