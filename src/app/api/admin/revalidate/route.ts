import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { revalidateStore } from "@/lib/revalidate-store";

/** Staff-only: refresh all storefront caches. Same-origin POST only. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(publicEnv.NEXT_PUBLIC_SITE_URL).origin) {
    return new NextResponse(null, { status: 403 });
  }
  try {
    await requireStaff();
  } catch {
    return new NextResponse(null, { status: 403 });
  }
  revalidateStore();
  return NextResponse.json({ ok: true });
}
