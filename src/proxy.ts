import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Runs only for the admin area. Keeps signed-out visitors away from /admin
 * and refreshes the session cookie. It is NOT the authorization boundary:
 * roles are checked again in the admin layout, in every server action, and
 * by Row Level Security in the database.
 *
 * The storefront has no customer accounts, so shop pages skip this entirely.
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const isPublicAdminPage = pathname === "/admin/login" || pathname === "/admin/forgot-password";
  if (!userId && !isPublicAdminPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    // Carry over any refreshed auth cookies.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
