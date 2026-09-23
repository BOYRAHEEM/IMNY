"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { minorToInput } from "@/lib/money";
import { deleteDiscount, saveDiscount } from "./actions";

export type DiscountValues = {
  id: string;
  code: string;
  description: string | null;
  type: "percentage" | "fixed";
  value: number;
  max_discount_minor: number | null;
  min_order_minor: number;
  starts_at: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  per_customer_limit: number | null;
  is_active: boolean;
};

/** ISO -> value for <input type="datetime-local"> (Accra is UTC+0). */
const toLocal = (iso: string | null) => (iso ? iso.slice(0, 16) : "");

export function DiscountForm({ discount }: { discount: DiscountValues | null }) {
  const [result, action] = useActionState(saveDiscount, null);
  const [type, setType] = useState<"percentage" | "fixed">(discount?.type ?? "percentage");
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  const initialValue = discount ? (discount.type === "percentage" ? String(discount.value) : minorToInput(discount.value)) : "";

  return (
    <form action={action} className="space-y-4 p-4 sm:p-5">
      <FormMessage result={result ?? (deleteError ? { ok: false, error: deleteError } : null)} />
      {discount && <input type="hidden" name="id" value={discount.id} />}

      <Field label="Code" htmlFor="d-code" hint="What customers type at checkout.">
        <Input
          id="d-code"
          name="code"
          defaultValue={discount?.code}
          required
          maxLength={32}
          autoCapitalize="characters"
          className="font-mono uppercase"
          placeholder="WELCOME10"
        />
      </Field>
      <Field label="Internal description" htmlFor="d-desc" optional>
        <Textarea id="d-desc" name="description" defaultValue={discount?.description ?? ""} maxLength={200} rows={2} className="min-h-16" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="d-type">
          <Select id="d-type" name="type" value={type} onChange={(e) => setType(e.target.value as "percentage" | "fixed")}>
            <option value="percentage">Percentage off</option>
            <option value="fixed">Fixed amount off</option>
          </Select>
        </Field>
        <Field label={type === "percentage" ? "Percent off" : "Amount off (GHS)"} htmlFor="d-value">
          <Input id="d-value" name="value" defaultValue={initialValue} required inputMode="decimal" placeholder={type === "percentage" ? "10" : "50.00"} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Minimum order (GHS)" htmlFor="d-min" optional>
          <Input id="d-min" name="min_order" defaultValue={discount?.min_order_minor ? minorToInput(discount.min_order_minor) : ""} inputMode="decimal" placeholder="0.00" />
        </Field>
        {type === "percentage" && (
          <Field label="Maximum discount (GHS)" htmlFor="d-max" optional hint="Caps the discount on large orders.">
            <Input id="d-max" name="max_discount" defaultValue={minorToInput(discount?.max_discount_minor)} inputMode="decimal" placeholder="No cap" />
          </Field>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="d-start" optional hint="Ghana time">
          <Input id="d-start" name="starts_at" type="datetime-local" defaultValue={toLocal(discount?.starts_at ?? null)} />
        </Field>
        <Field label="Ends" htmlFor="d-end" optional hint="Ghana time">
          <Input id="d-end" name="expires_at" type="datetime-local" defaultValue={toLocal(discount?.expires_at ?? null)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Total uses allowed" htmlFor="d-limit" optional hint={discount ? `Used ${discount.usage_count} time${discount.usage_count === 1 ? "" : "s"} so far.` : "Leave empty for unlimited."}>
          <Input id="d-limit" name="usage_limit" defaultValue={discount?.usage_limit ?? ""} inputMode="numeric" placeholder="Unlimited" />
        </Field>
        <Field label="Uses per customer" htmlFor="d-per" optional hint="Counted by email address.">
          <Input id="d-per" name="per_customer_limit" defaultValue={discount?.per_customer_limit ?? ""} inputMode="numeric" placeholder="Unlimited" />
        </Field>
      </div>

      <Checkbox name="is_active" label="Active" hint="Customers can only use active codes." defaultChecked={discount?.is_active ?? true} />

      <div className="flex flex-wrap gap-2 pt-2">
        <SubmitButton pendingText="Saving…">{discount ? "Save discount" : "Create discount"}</SubmitButton>
        <Link href="/admin/discounts" className={buttonClasses("ghost")}>
          Cancel
        </Link>
      </div>

      {discount && discount.usage_count === 0 && (
        <div className="border-t border-line pt-4">
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-bad">Delete this code?</span>
              <Button
                variant="danger"
                size="sm"
                disabled={deleting}
                onClick={() =>
                  startDelete(async () => {
                    const r = await deleteDiscount(discount.id);
                    if (r && !r.ok) {
                      setConfirming(false);
                      setDeleteError(r.error);
                    }
                  })
                }
              >
                Yes, delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
              Delete discount
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
