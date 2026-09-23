"use client";

import { useActionState, useState } from "react";
import { orderStatusLabel } from "@/components/admin/status";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { addOrderNote, markOrderRefunded, recordCashPayment, resolveAttention, updateOrderStatus } from "../actions";

const FLOW = ["pending", "confirmed", "processing", "ready", "shipped", "delivered"] as const;

export function StatusPanel({
  orderId,
  status,
  paymentStatus,
  paymentMethod,
  stockCommitted,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  stockCommitted: boolean;
}) {
  const [result, action] = useActionState(updateOrderStatus, null);
  const [cancelling, setCancelling] = useState(false);

  if (status === "delivered" || status === "cancelled") {
    return (
      <p className="p-4 text-sm text-muted sm:p-5">
        This order is {orderStatusLabel(status).toLowerCase()} and can&apos;t be changed.
      </p>
    );
  }

  const next = FLOW.slice(FLOW.indexOf(status as (typeof FLOW)[number]) + 1);
  // Pay-on-delivery orders can be fulfilled before the cash is collected.
  const paid = paymentStatus === "paid" || (paymentMethod === "cod" && paymentStatus === "pending");

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <FormMessage result={result} />

      {!cancelling ? (
        <>
          {paid ? (
            <form action={action} className="space-y-3">
              <input type="hidden" name="order_id" value={orderId} />
              <Field label="Move to" htmlFor="next-status">
                <Select id="next-status" name="status" defaultValue={next[0]}>
                  {next.map((s) => (
                    <option key={s} value={s}>
                      {orderStatusLabel(s)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Note" htmlFor="status-note" optional hint="Internal only, e.g. rider name or tracking number.">
                <Textarea id="status-note" name="note" maxLength={2000} rows={2} className="min-h-16" />
              </Field>
              <SubmitButton className="w-full" pendingText="Updating…">
                Update status
              </SubmitButton>
            </form>
          ) : (
            <p className="text-sm text-muted">
              {paymentStatus === "pending"
                ? "Waiting for the customer to finish paying. Unpaid orders are cancelled automatically when the stock hold expires."
                : "This order hasn't been paid, so it can't be fulfilled."}
            </p>
          )}
          <Button variant="danger" size="sm" className="w-full" onClick={() => setCancelling(true)}>
            Cancel order
          </Button>
        </>
      ) : (
        <form action={action} className="space-y-3 border border-bad/25 bg-bad-bg p-3">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="status" value="cancelled" />
          <p className="text-sm font-medium text-bad">Cancel this order?</p>
          <Field label="Reason" htmlFor="cancel-note" optional>
            <Textarea id="cancel-note" name="note" maxLength={300} rows={2} className="min-h-16 bg-paper" />
          </Field>
          {stockCommitted && <Checkbox name="restock" defaultChecked label="Put the items back in stock" />}
          {paid && (
            <p className="text-sm text-bad">
              This order was paid. After cancelling, refund the customer in your Paystack dashboard, then mark it refunded here.
            </p>
          )}
          <div className="flex gap-2">
            <SubmitButton variant="danger" size="sm" pendingText="Cancelling…">
              Yes, cancel order
            </SubmitButton>
            <Button variant="ghost" size="sm" onClick={() => setCancelling(false)}>
              Keep order
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function NoteForm({ orderId }: { orderId: string }) {
  const [result, action] = useActionState(addOrderNote, null);
  return (
    // React resets the form's fields after the action completes.
    <form action={action} className="space-y-2">
      <FormMessage result={result && !result.ok ? result : null} />
      <input type="hidden" name="order_id" value={orderId} />
      <Textarea name="body" required maxLength={2000} rows={2} placeholder="Add an internal note" aria-label="Internal note" className="min-h-16" />
      <SubmitButton variant="secondary" size="sm" pendingText="Adding…">
        Add note
      </SubmitButton>
    </form>
  );
}

export function CashPaymentForm({ orderId, amount }: { orderId: string; amount: string }) {
  const [result, action] = useActionState(recordCashPayment, null);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Record cash received
      </Button>
    );
  return (
    <form action={action} className="space-y-2">
      <FormMessage result={result} />
      <input type="hidden" name="order_id" value={orderId} />
      <p className="text-sm text-muted">Confirm {amount} in cash was collected for this order.</p>
      <Textarea name="note" maxLength={2000} rows={2} placeholder="e.g. Collected by rider Kofi" aria-label="Note" className="min-h-16" />
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="Saving…">
          Confirm cash received
        </SubmitButton>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function RefundForm({ orderId }: { orderId: string }) {
  const [result, action] = useActionState(markOrderRefunded, null);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Mark as refunded
      </Button>
    );
  return (
    <form action={action} className="space-y-2">
      <FormMessage result={result} />
      <input type="hidden" name="order_id" value={orderId} />
      <p className="text-sm text-muted">Only do this after issuing the refund in Paystack. This records it; it doesn&apos;t send money.</p>
      <Textarea name="note" maxLength={2000} rows={2} placeholder="Refund reference (optional)" aria-label="Refund note" className="min-h-16" />
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="Saving…">
          Confirm refund recorded
        </SubmitButton>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ResolveForm({ orderId }: { orderId: string }) {
  const [result, action] = useActionState(resolveAttention, null);
  return (
    <form action={action} className="mt-3 flex flex-col gap-2 sm:flex-row">
      <FormMessage result={result && !result.ok ? result : null} />
      <input type="hidden" name="order_id" value={orderId} />
      <input
        name="note"
        placeholder="What did you do? (optional)"
        aria-label="Resolution note"
        maxLength={2000}
        className="h-10 flex-1 rounded-sm border border-bad/30 bg-paper px-3 text-sm focus:border-ink focus:outline-none"
      />
      <SubmitButton variant="secondary" size="sm" className="h-10" pendingText="Saving…">
        Mark resolved
      </SubmitButton>
    </form>
  );
}
