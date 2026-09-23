import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for Supabase email links (password reset, email confirmation).
 * Exchanges the one-time code for a session, then continues to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  // Relative paths only: never redirect off-site.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    logError("auth.callback", error);
  }

  const failTo = next.startsWith("/admin") ? "/admin/login?error=link" : "/login?error=link";
  return NextResponse.redirect(`${origin}${failTo}`);
}
