import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "customer" | "staff" | "admin";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
};

/**
 * The verified signed-in user and their role, read from the database (never
 * from client-editable metadata). Deduplicated per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .single();

  if (!profile) return null;
  return { id: profile.id, email: profile.email, fullName: profile.full_name, role: profile.role as Role };
});

const STAFF_ROLES: Role[] = ["staff", "admin"];

export class AuthorizationError extends Error {
  constructor() {
    super("FORBIDDEN");
    this.name = "AuthorizationError";
  }
}

/** For pages and layouts: redirect anyone without the required role. */
export async function requireStaffPage(opts: { adminOnly?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (!STAFF_ROLES.includes(user.role)) redirect("/admin/login?error=forbidden");
  if (opts.adminOnly && user.role !== "admin") redirect("/admin?error=admin-only");
  return user;
}

/** For server actions and route handlers: throw instead of redirecting. */
export async function requireStaff(opts: { adminOnly?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !STAFF_ROLES.includes(user.role)) throw new AuthorizationError();
  if (opts.adminOnly && user.role !== "admin") throw new AuthorizationError();
  return user;
}
