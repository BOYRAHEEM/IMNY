import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { requireStaffPage } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { catalogImageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";
import { LookbookManager } from "./lookbook-manager";

export const metadata = { title: "Lookbook" };

export default async function AdminLookbookPage() {
  await requireStaffPage();
  const supabase = await createClient();
  const { data, error } = await supabase.from("lookbook_images").select("id, storage_path, label, alt_text").order("position").order("created_at");
  if (error) logError("admin.lookbook", error);

  return (
    <>
      <PageHeader
        title="Lookbook"
        description={
          <>
            Campaign photos for the{" "}
            <Link href="/lookbook" target="_blank" className="underline underline-offset-4">
              lookbook page
            </Link>
            .
          </>
        }
      />
      <LookbookManager looks={(data ?? []).map((l) => ({ id: l.id, url: catalogImageUrl(l.storage_path)!, label: l.label, alt_text: l.alt_text }))} />
    </>
  );
}
