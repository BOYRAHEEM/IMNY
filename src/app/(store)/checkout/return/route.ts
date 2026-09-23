import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { confirmPayment } from "@/lib/checkout/confirm-payment";
import { publicEnv } from "@/lib/env";

/**
 * Where the gateway sends the customer after paying. The URL itself proves
 * nothing: the payment is verified server-to-server before anything changes.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const reference = params.get("reference") ?? params.get("trxref") ?? "";
  const site = publicEnv.NEXT_PUBLIC_SITE_URL;

  if (!/^[A-Za-z0-9_-]{8,100}$/.test(reference)) {
    return NextResponse.redirect(`${site}/cart`);
  }

  const outcome = await confirmPayment(reference);

  if (outcome === "failed") {
    return NextResponse.redirect(`${site}/checkout?payment=failed`);
  }

  const [orderNumber, token] = ((await cookies()).get("imny_order")?.value ?? "").split(".");
  const q = new URLSearchParams({ status: outcome });
  if (orderNumber && token) {
    q.set("order", orderNumber);
    q.set("token", token);
  }
  return NextResponse.redirect(`${site}/order-confirmation?${q}`);
}
