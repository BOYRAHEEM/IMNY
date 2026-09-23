import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * First line of defence only: keeps signed-out visitors away from /admin and
 * /account and refreshes sessions. It is NOT the authorization boundary.
 * Roles are checked again in the admin layout, in every server action, and by
 * Row Level Security in the database.
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminLogin = pathname === "/admin/login";
  const isAccountArea = pathname === "/account" || pathname.startsWith("/account/");

  if (!userId && isAdminArea && !isAdminLogin) {
    return redirectTo(request, "/admin/login", pathname + search, response);
  }
  if (!userId && isAccountArea) {
    return redirectTo(request, "/login", pathname + search, response);
  }

  return response;
}

function redirectTo(request: NextRequest, path: string, next: string, base: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = `?next=${encodeURIComponent(next)}`;
  const redirect = NextResponse.redirect(url);
  // Carry over any refreshed auth cookies.
  for (const cookie of base.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: [
    // Everything except static assets, image optimisation, metadata files and
    // the payment webhook (which authenticates by signature, not cookies).
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
