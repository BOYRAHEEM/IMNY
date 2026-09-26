import Link from "next/link";
import { z } from "zod";
import { Icon } from "@/components/admin/icons";
import { PageHeader, Panel, filterTab } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { requireStaffPage } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { resolveContent } from "@/content/site";
import { catalogImageUrl } from "@/lib/images";
import { GHANA_REGIONS } from "@/lib/validation/checkout";
import { AddTeamMemberForm, RefreshStoreForm, SettingsForm, TeamRoleForm, ZoneForm, type SettingsValues, type ZoneValues } from "./forms";
import { ContentForm, SiteImageField } from "./site-forms";

export const metadata = { title: "Settings" };

const SECTIONS = [
  { id: "store", label: "Store" },
  { id: "photos", label: "Photos" },
  { id: "page-text", label: "Page text" },
  { id: "delivery", label: "Delivery" },
  { id: "team", label: "Team" },
  { id: "storefront", label: "Storefront" },
];

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
  const settingsRow = settingsRes.data as { hero_image_path: string | null; about_image_path: string | null; content: unknown } | null;
  const zones = (zonesRes.data ?? []) as ZoneValues[];
  const team = teamRes.data ?? [];
  const editingZone = zoneParam && z.uuid().safeParse(zoneParam).success ? zones.find((zn) => zn.id === zoneParam) ?? null : null;
  const addingZone = zoneParam === "new";
  const covered = new Set(zones.filter((zn) => zn.is_active).flatMap((zn) => zn.regions));
  const uncovered = GHANA_REGIONS.filter((r) => !covered.has(r));

  return (
    <>
      <PageHeader title="Settings" description="Store details, delivery fees and who can access this dashboard." />

      {/* Section shortcuts: this page is long, especially on a phone. */}
      <nav aria-label="Settings sections" className="no-scrollbar sticky top-16 z-20 -mx-4 mb-4 overflow-x-auto bg-bone/90 px-4 py-2 backdrop-blur-md lg:top-0">
        <ul className="flex gap-1.5">
          {SECTIONS.map((sec) => (
            <li key={sec.id}>
              <a href={`#${sec.id}`} className={filterTab(false)}>
                {sec.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-6">
        {settings ? (
          <>
            <Panel title="Store" id="store">
              <SettingsForm s={settings} />
            </Panel>
            <Panel title="Homepage & about photos" id="photos">
              <div className="grid gap-6 p-4 sm:grid-cols-2 sm:p-5">
                <SiteImageField
                  field="hero_image_path"
                  folder="hero"
                  label="Homepage campaign photo"
                  hint="Portrait (4:5) works best. Shown next to the headline."
                  currentUrl={catalogImageUrl(settingsRow?.hero_image_path)}
                />
                <SiteImageField
                  field="about_image_path"
                  folder="about"
                  label="About page photo"
                  hint="Studio or behind-the-scenes shot, portrait."
                  currentUrl={catalogImageUrl(settingsRow?.about_image_path)}
                />
              </div>
            </Panel>
            <Panel title="Page text" id="page-text">
              <ContentForm content={resolveContent(settingsRow?.content)} />
            </Panel>
          </>
        ) : (
          <p role="alert" className="rounded-2xl border border-bad/25 bg-bad-bg px-4 py-3 text-sm text-bad">
            Settings couldn&apos;t be loaded. Refresh to try again.
          </p>
        )}

        <section id="delivery" className="scroll-mt-32 lg:scroll-mt-20">
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
                <p role="status" className="rounded-2xl border border-good/25 bg-good-bg px-3 py-2 text-sm text-good">
                  {zoneParam === "saved" ? "Delivery zone saved." : "Delivery zone deleted."}
                </p>
              )}
              {zones.length === 0 && !addingZone && (
                <p className="rounded-2xl border border-warn/25 bg-warn-bg px-3 py-2.5 text-sm text-warn">
                  Add at least one delivery zone. Customers can&apos;t check out until there is one.
                </p>
              )}
              {zones.length > 0 && uncovered.length > 0 && (
                <p className="rounded-2xl border border-warn/25 bg-warn-bg px-3 py-2.5 text-sm text-warn">
                  No active zone delivers to {uncovered.join(", ")}. Customers there can&apos;t check out.
                </p>
              )}
              {addingZone && <ZoneForm zone={null} />}
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
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
                            {zn.allow_cod && <Badge tone="info">Pay on delivery</Badge>}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {[
                              zn.regions.length === 0 ? "No regions" : zn.regions.length > 3 ? `${zn.regions.length} regions` : zn.regions.join(", "),
                              zn.estimated_days,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
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

        <Panel title="Team" id="team">
          <div className="space-y-4 p-4 sm:p-5">
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
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

        <Panel title="Storefront" id="storefront">
          <div className="p-4 sm:p-5">
            <RefreshStoreForm />
          </div>
        </Panel>
      </div>
    </>
  );
}
