"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { minorToInput } from "@/lib/money";
import { addTeamMember, changeTeamRole, deleteZone, refreshStorefront, saveSettings, saveZone } from "./actions";

export type SettingsValues = {
  store_name: string;
  tagline: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp_number: string | null;
  business_address: string | null;
  announcement: string | null;
  currency: string;
  order_prefix: string;
  low_stock_threshold: number;
  reservation_minutes: number;
  max_quantity_per_item: number;
  free_delivery_over_minor: number | null;
  allow_guest_checkout: boolean;
  seo_title: string | null;
  seo_description: string | null;
  social_links: Record<string, string>;
};

export function SettingsForm({ s }: { s: SettingsValues }) {
  const [result, action] = useActionState(saveSettings, null);
  const social = s.social_links ?? {};

  return (
    <form action={action} className="divide-y divide-line">
      <div className="p-4 sm:p-5">
        <FormMessage result={result} />
      </div>

      <fieldset className="space-y-4 p-4 sm:p-5">
        <legend className="mb-2 text-sm font-semibold">Store</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Store name" htmlFor="s-name">
            <Input id="s-name" name="store_name" defaultValue={s.store_name} required maxLength={80} />
          </Field>
          <Field label="Tagline" htmlFor="s-tagline" optional>
            <Input id="s-tagline" name="tagline" defaultValue={s.tagline ?? ""} maxLength={160} />
          </Field>
        </div>
        <Field label="Announcement bar" htmlFor="s-announcement" optional hint="A short line shown at the top of every page, e.g. free delivery offer.">
          <Input id="s-announcement" name="announcement" defaultValue={s.announcement ?? ""} maxLength={200} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4 p-4 sm:p-5">
        <legend className="mb-2 text-sm font-semibold">Contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="s-email" optional>
            <Input id="s-email" name="contact_email" type="email" defaultValue={s.contact_email ?? ""} />
          </Field>
          <Field label="Phone" htmlFor="s-phone" optional>
            <Input id="s-phone" name="contact_phone" type="tel" defaultValue={s.contact_phone ?? ""} maxLength={32} />
          </Field>
          <Field label="WhatsApp number" htmlFor="s-wa" optional hint="With country code, e.g. 233241234567">
            <Input id="s-wa" name="whatsapp_number" type="tel" defaultValue={s.whatsapp_number ?? ""} maxLength={32} />
          </Field>
          <Field label="Address" htmlFor="s-address" optional>
            <Input id="s-address" name="business_address" defaultValue={s.business_address ?? ""} maxLength={300} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4 p-4 sm:p-5">
        <legend className="mb-2 text-sm font-semibold">Social</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["instagram", "tiktok", "facebook", "x"] as const).map((k) => (
            <Field key={k} label={k === "x" ? "X (Twitter)" : k[0].toUpperCase() + k.slice(1)} htmlFor={`s-${k}`} optional>
              <Input id={`s-${k}`} name={k} type="url" defaultValue={social[k] ?? ""} placeholder="https://" />
            </Field>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-4 p-4 sm:p-5">
        <legend className="mb-2 text-sm font-semibold">Checkout & stock</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Free delivery over (GHS)" htmlFor="s-free" optional hint="Applies to every zone. Zones can also set their own.">
            <Input id="s-free" name="free_delivery_over_minor" defaultValue={minorToInput(s.free_delivery_over_minor)} inputMode="decimal" placeholder="No free delivery" />
          </Field>
          <Field label="Max quantity per item" htmlFor="s-maxq" hint="Per variant, per order.">
            <Input id="s-maxq" name="max_quantity_per_item" type="number" inputMode="numeric" min={1} max={100} defaultValue={s.max_quantity_per_item} />
          </Field>
          <Field label="Low-stock alert at" htmlFor="s-low" hint="Warn when this many or fewer are available.">
            <Input id="s-low" name="low_stock_threshold" type="number" inputMode="numeric" min={0} max={1000} defaultValue={s.low_stock_threshold} />
          </Field>
          <Field label="Hold stock during payment (minutes)" htmlFor="s-hold" hint="Unpaid orders release their items after this.">
            <Input id="s-hold" name="reservation_minutes" type="number" inputMode="numeric" min={5} max={240} defaultValue={s.reservation_minutes} />
          </Field>
          <Field label="Order number prefix" htmlFor="s-prefix" hint={`Orders look like ${s.order_prefix}1024.`}>
            <Input id="s-prefix" name="order_prefix" defaultValue={s.order_prefix} maxLength={6} autoCapitalize="characters" className="uppercase" />
          </Field>
          <Field label="Currency" htmlFor="s-currency" hint="Set by your payment provider.">
            <Input id="s-currency" value={s.currency} disabled readOnly />
          </Field>
        </div>
        <Checkbox name="allow_guest_checkout" label="Allow checkout without an account" defaultChecked={s.allow_guest_checkout} />
      </fieldset>

      <fieldset className="space-y-4 p-4 sm:p-5">
        <legend className="mb-2 text-sm font-semibold">Search engines</legend>
        <Field label="Home page title" htmlFor="s-seo-title" optional>
          <Input id="s-seo-title" name="seo_title" defaultValue={s.seo_title ?? ""} maxLength={120} />
        </Field>
        <Field label="Home page description" htmlFor="s-seo-desc" optional>
          <Textarea id="s-seo-desc" name="seo_description" defaultValue={s.seo_description ?? ""} maxLength={320} rows={2} className="min-h-16" />
        </Field>
      </fieldset>

      <div className="p-4 sm:p-5">
        <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  );
}

export type ZoneValues = {
  id: string;
  name: string;
  description: string | null;
  fee_minor: number;
  free_over_minor: number | null;
  estimated_days: string | null;
  sort_order: number;
  is_active: boolean;
};

export function ZoneForm({ zone }: { zone: ZoneValues | null }) {
  const [result, action] = useActionState(saveZone, null);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form action={action} className="space-y-4 border border-line bg-mist p-4">
      <FormMessage result={result ?? (deleteError ? { ok: false, error: deleteError } : null)} />
      {zone && <input type="hidden" name="id" value={zone.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Zone name" htmlFor="z-name">
          <Input id="z-name" name="name" defaultValue={zone?.name} required maxLength={80} placeholder="e.g. Accra & Tema" className="bg-paper" />
        </Field>
        <Field label="Delivery time" htmlFor="z-days" optional>
          <Input id="z-days" name="estimated_days" defaultValue={zone?.estimated_days ?? ""} maxLength={40} placeholder="1-2 days" className="bg-paper" />
        </Field>
        <Field label="Fee (GHS)" htmlFor="z-fee">
          <Input id="z-fee" name="fee" defaultValue={zone ? minorToInput(zone.fee_minor) : ""} required inputMode="decimal" placeholder="30.00" className="bg-paper" />
        </Field>
        <Field label="Free over (GHS)" htmlFor="z-free" optional>
          <Input id="z-free" name="free_over" defaultValue={minorToInput(zone?.free_over_minor)} inputMode="decimal" placeholder="Never free" className="bg-paper" />
        </Field>
      </div>
      <Field label="Areas covered" htmlFor="z-desc" optional hint="Shown to customers at checkout.">
        <Input id="z-desc" name="description" defaultValue={zone?.description ?? ""} maxLength={300} className="bg-paper" />
      </Field>
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Order" htmlFor="z-order" className="w-24">
          <Input id="z-order" name="sort_order" type="number" inputMode="numeric" defaultValue={zone?.sort_order ?? 0} className="bg-paper" />
        </Field>
        <Checkbox name="is_active" label="Available at checkout" defaultChecked={zone?.is_active ?? true} />
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton size="sm" pendingText="Saving…">
          {zone ? "Save zone" : "Add zone"}
        </SubmitButton>
        <Link href="/admin/settings#delivery" className={buttonClasses("ghost", "sm")}>
          Cancel
        </Link>
        {zone &&
          (confirming ? (
            <span className="flex items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await deleteZone(zone.id);
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
                Keep
              </Button>
            </span>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirming(true)} className="ml-auto">
              Delete
            </Button>
          ))}
      </div>
    </form>
  );
}

export function RefreshStoreForm() {
  const [result, action] = useActionState(refreshStorefront, null);
  return (
    <form action={action} className="space-y-3">
      <FormMessage result={result} />
      <p className="text-sm text-muted">
        Changes made here in the dashboard show up straight away. If you ever edit data directly in Supabase, press this so
        the store picks it up.
      </p>
      <SubmitButton variant="secondary" size="sm" pendingText="Refreshing…">
        Refresh storefront
      </SubmitButton>
    </form>
  );
}

export function AddTeamMemberForm() {
  const [result, action] = useActionState(addTeamMember, null);
  return (
    <form action={action} className="space-y-3">
      <FormMessage result={result} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input name="email" type="email" required placeholder="their@email.com" aria-label="Email address" className="sm:flex-1" />
        <Select name="role" defaultValue="staff" aria-label="Role" className="sm:w-32">
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </Select>
        <SubmitButton pendingText="Adding…">Give access</SubmitButton>
      </div>
      <p className="text-xs text-muted">New people get an email invitation to set their password.</p>
    </form>
  );
}

export function TeamRoleForm({ userId, role, isSelf }: { userId: string; role: "staff" | "admin" | "customer"; isSelf: boolean }) {
  const [result, action] = useActionState(changeTeamRole, null);
  if (isSelf) return <span className="text-sm text-muted capitalize">{role} (you)</span>;
  return (
    <form action={action} className="flex items-center gap-2">
      <Select name="role" defaultValue={role} aria-label="Role" className="h-9 w-32" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        <option value="staff">Staff</option>
        <option value="admin">Admin</option>
        <option value="customer">Remove access</option>
      </Select>
      <input type="hidden" name="user_id" value={userId} />
      {result && !result.ok && (
        <span role="alert" className="text-xs text-bad">
          {result.error}
        </span>
      )}
    </form>
  );
}
