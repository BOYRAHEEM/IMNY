import { notFound } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { isDevPaymentsEnabled, setDevOutcome } from "@/lib/payments/dev";

/**
 * LOCAL DEVELOPMENT ONLY. Records the simulated outcome, then does a
 * full-page redirect to the return URL, exactly as a real gateway would.
 */
export async function GET(request: NextRequest) {
  if (!isDevPaymentsEnabled()) notFound();
  const reference = request.nextUrl.searchParams.get("reference") ?? "";
  const outcome = request.nextUrl.searchParams.get("outcome") === "success" ? "success" : "failed";
  setDevOutcome(reference, outcome);
  return NextResponse.redirect(`${publicEnv.NEXT_PUBLIC_SITE_URL}/checkout/return?reference=${encodeURIComponent(reference)}`);
}
