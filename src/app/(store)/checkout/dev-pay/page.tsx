import { notFound, redirect } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { getDevPayment, isDevPaymentsEnabled, setDevOutcome } from "@/lib/payments/dev";

export const metadata = { title: "Test payment", robots: { index: false } };

/** Stand-in for the Paystack payment page. Only exists in local development. */
export default async function DevPayPage({ searchParams }: PageProps<"/checkout/dev-pay">) {
  if (!isDevPaymentsEnabled()) notFound();
  const reference = String((await searchParams).reference ?? "");
  const payment = getDevPayment(reference);
  if (!payment) notFound();

  async function complete(formData: FormData) {
    "use server";
    if (!isDevPaymentsEnabled()) notFound();
    const outcome = formData.get("outcome") === "success" ? "success" : "failed";
    setDevOutcome(reference, outcome);
    redirect(`/checkout/return?reference=${encodeURIComponent(reference)}`);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="mb-2 text-xs tracking-widest text-warn uppercase">Test payment · local development only</p>
      <h1 className="font-display text-4xl">{formatMoney(payment.amountMinor, payment.currency)}</h1>
      <p className="mt-2 text-sm text-muted">This page stands in for Paystack. No money moves.</p>
      <form action={complete} className="mt-10 flex flex-col gap-3">
        <button name="outcome" value="success" className="h-12 bg-ink text-sm tracking-wide text-paper uppercase">
          Simulate successful payment
        </button>
        <button name="outcome" value="failed" className="h-12 border border-ink text-sm tracking-wide uppercase">
          Simulate failed payment
        </button>
      </form>
    </div>
  );
}
