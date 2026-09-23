import Link from "next/link";
import { z } from "zod";
import { Icon } from "@/components/admin/icons";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireStaffPage } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { logError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { DiscountForm, type DiscountValues } from "./discount-form";

export const metadata = { title: "Discounts" };

function discountState(d: DiscountValues, now: number): { label: string; tone: "good" | "warn" | "neutral" } {
  if (!d.is_active) return { label: "Off", tone: "neutral" };
  if (d.starts_at && Date.parse(d.starts_at) > now) return { label: "Scheduled", tone: "warn" };
  if (d.expires_at && Date.parse(d.expires_at) <= now) return { label: "Expired", tone: "neutral" };
  if (d.usage_limit !== null && d.usage_count >= d.usage_limit) return { label: "Used up", tone: "neutral" };
  return { label: "Live", tone: "good" };
}

export default async function DiscountsPage({ searchParams }: PageProps<"/admin/discounts">) {
  const user = await requireStaffPage();
  const isAdmin = user.role === "admin";
  const sp = await searchParams;
  const editId = typeof sp.edit === "string" && z.uuid().safeParse(sp.edit).success ? sp.edit : null;
  const creating = sp.new === "1" && isAdmin;

  const supabase = await createClient();
  const [{ data, error }, { data: settings }] = await Promise.all([
    supabase.from("discount_codes").select("*").order("created_at", { ascending: false }),
    supabase.from("store_settings").select("currency").single(),
  ]);
  if (error) logError("discounts.list", error);
  const currency = settings?.currency ?? "GHS";
  const discounts = (data ?? []) as DiscountValues[];
  const editing = isAdmin && editId ? discounts.find((d) => d.id === editId) ?? null : null;
  const showForm = creating || editing;
  // Request time is the reference point for "live" vs "expired".
  const now = new Date().getTime();

  return (
    <>
      <PageHeader
        title="Discounts"
        description="Codes customers enter at checkout. Discounts are always checked and calculated on the server."
        actions={
          isAdmin &&
          !showForm && (
            <ButtonLink href="/admin/discounts?new=1">
              <Icon name="plus" className="size-4" /> Create discount
            </ButtonLink>
          )
        }
      />

      {!isAdmin && (
        <p className="mb-4 border border-line bg-paper px-4 py-3 text-sm text-muted">Only admins can create or change discounts.</p>
      )}
      {(sp.saved === "1" || sp.deleted === "1") && (
        <p role="status" className="mb-4 border border-good/25 bg-good-bg px-4 py-3 text-sm text-good">
          {sp.saved === "1" ? "Discount saved." : "Discount deleted."}
        </p>
      )}

      <div className={cn("grid gap-6", showForm && "lg:grid-cols-[1fr_420px]")}>
        {showForm && (
          <div className="lg:order-2">
            <Panel title={editing ? `Edit ${editing.code}` : "New discount"}>
              <DiscountForm key={editing?.id ?? "new"} discount={editing} />
            </Panel>
          </div>
        )}

        <div className="lg:order-1">
          {discounts.length === 0 ? (
            !showForm && (
              <EmptyState
                title="No discount codes yet."
                description="Create a code for a sale, a launch or loyal customers."
                action={isAdmin && <ButtonLink href="/admin/discounts?new=1">Create a discount</ButtonLink>}
              />
            )
          ) : (
            <ul className="divide-y divide-line border border-line bg-paper">
              {discounts.map((d) => {
                const state = discountState(d, now);
                const body = (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium">{d.code}</span>
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </p>
                      <p className="mt-0.5 text-sm text-ink-soft">
                        {d.type === "percentage" ? `${d.value}% off` : `${formatMoney(d.value, currency)} off`}
                        {d.min_order_minor > 0 && ` orders over ${formatMoney(d.min_order_minor, currency)}`}
                        {d.max_discount_minor && ` · max ${formatMoney(d.max_discount_minor, currency)}`}
                      </p>
                      {(d.starts_at || d.expires_at) && (
                        <p className="mt-0.5 text-xs text-muted">
                          {d.starts_at && `From ${formatDate(d.starts_at)} `}
                          {d.expires_at && `until ${formatDate(d.expires_at)}`}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-right text-sm text-muted tabular">
                      {d.usage_count}
                      {d.usage_limit ? ` / ${d.usage_limit}` : ""} used
                    </p>
                  </>
                );
                return (
                  <li key={d.id}>
                    {isAdmin ? (
                      <Link
                        href={`/admin/discounts?edit=${d.id}`}
                        className={cn("flex items-start gap-4 px-4 py-3 hover:bg-mist", editing?.id === d.id && "bg-mist")}
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-4 px-4 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
