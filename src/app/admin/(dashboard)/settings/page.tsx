import Link from "next/link";
import { z } from "zod";
import { Icon } from "@/components/admin/icons";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { requireStaffPage } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { AddTeamMemberForm, RefreshStoreForm, SettingsForm, TeamRoleForm, ZoneForm, type SettingsValues, type ZoneValues } from "./forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  const user = await requireStaffPage({ adminOnly: true });
  const sp = await searchParams;
  const zoneParam = typeof sp.zone === "string" ? sp.zone : null;

  const supabase = await createClient();
  const [settingsRes, zonesRes, teamRes] = await Promise.all([
    supabase.from("store_settings").select("*").single(),
    supabase.from("delivery_zones").select("*").order("sort_order").order("name"),
    supabase.rpc("admin_team"),
  ]);
  for (const [name, res] of [["settings", settingsRes], ["zones", zonesRes], ["team", teamRes]] as const) {
    if (res.error) logError(`settings.${name}`, res.error);
  }

  const settings = settingsRes.data as SettingsValues | null;
  const zones = (zonesRes.data ?? []) as ZoneValues[];
  const team = teamRes.data ?? [];
  const editingZone = zoneParam && z.uuid().safeParse(zoneParam).success ? zones.find((zn) => zn.id === zoneParam) ?? null : null;
  const addingZone = zoneParam === "new";

  return (
    <>
      <PageHeader title="Settings" description="Store details, delivery fees and who can access this dashboard." />

      <div className="space-y-6">
        {settings ? (
          <Panel title="Store">
            <SettingsForm s={settings} />
          </Panel>
        ) : (
          <p role="alert" className="border border-bad/25 bg-bad-bg px-4 py-3 text-sm text-bad">
            Settings couldn&apos;t be loaded. Refresh to try again.
          </p>
        )}

        <section id="delivery" className="scroll-mt-20">
          <Panel
            title="Delivery zones"
            action={
              !addingZone && (
                <Link href="/admin/settings?zone=new#delivery" className="flex items-center gap-1 text-sm text-muted hover:text-ink">
                  <Icon name="plus" className="size-4" /> Add zone
                </Link>
              )
            }
          >
            <div className="space-y-3 p-4 sm:p-5">
              {(zoneParam === "saved" || zoneParam === "deleted") && (
                <p role="status" className="border border-good/25 bg-good-bg px-3 py-2 text-sm text-good">
                  {zoneParam === "saved" ? "Delivery zone saved." : "Delivery zone deleted."}
                </p>
              )}
              {zones.length === 0 && !addingZone && (
                <p className="border border-warn/25 bg-warn-bg px-3 py-2.5 text-sm text-warn">
                  Add at least one delivery zone. Customers can&apos;t check out until there is one.
                </p>
              )}
              {addingZone && <ZoneForm zone={null} />}
              <ul className="divide-y divide-line border border-line">
                {zones.map((zn) =>
                  editingZone?.id === zn.id ? (
                    <li key={zn.id} className="p-2">
                      <ZoneForm zone={zn} />
                    </li>
                  ) : (
                    <li key={zn.id}>
                      <Link href={`/admin/settings?zone=${zn.id}#delivery`} className="flex items-center gap-3 px-3 py-3 hover:bg-mist">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            {zn.name}
                            {!zn.is_active && <Badge>Off</Badge>}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {[zn.description, zn.estimated_days].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <div className="text-right text-sm tabular">
                          <p>{zn.fee_minor ? formatMoney(zn.fee_minor, settings?.currency) : "Free"}</p>
                          {zn.free_over_minor !== null && (
                            <p className="text-xs text-muted">Free over {formatMoney(zn.free_over_minor, settings?.currency)}</p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </Panel>
        </section>

        <Panel title="Team">
          <div className="space-y-4 p-4 sm:p-5">
            <ul className="divide-y divide-line border border-line">
              {team.map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.full_name || m.email}</p>
                    {m.full_name && <p className="truncate text-xs text-muted">{m.email}</p>}
                  </div>
                  <TeamRoleForm userId={m.user_id} role={m.role} isSelf={m.user_id === user.id} />
                </li>
              ))}
            </ul>
            <div>
              <h3 className="mb-2 text-sm font-medium">Add someone</h3>
              <AddTeamMemberForm />
            </div>
            <p className="text-xs text-muted">
              Staff can manage products, stock and orders. Only admins can change discounts, settings, the team, delete
              products or record refunds.
            </p>
          </div>
        </Panel>

        <Panel title="Storefront">
          <div className="p-4 sm:p-5">
            <RefreshStoreForm />
          </div>
        </Panel>
      </div>
    </>
  );
}
