import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/errors";
import { safeAdminNext } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for Supabase email links (password reset, email confirmation).
 * Exchanges the one-time code for a session, then continues to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeAdminNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    logError("auth.callback", error);
  }

  return NextResponse.redirect(`${origin}/admin/login?error=link`);
}
