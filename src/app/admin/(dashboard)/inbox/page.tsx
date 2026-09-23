import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireStaffPage } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { logError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { CopyEmails, HandledToggle, RemoveSubscriber } from "./inbox-controls";

export const metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: PageProps<"/admin/inbox">) {
  const user = await requireStaffPage();
  const sp = await searchParams;
  const tab = sp.tab === "newsletter" ? "newsletter" : "messages";
  const showHandled = sp.handled === "1";
  const supabase = await createClient();

  const [messages, subscribers] = await Promise.all([
    supabase
      .from("contact_messages")
      .select("id, email, message, handled, created_at")
      .eq("handled", showHandled)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("newsletter_subscribers").select("id, email, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(2000),
  ]);
  if (messages.error) logError("inbox.messages", messages.error);
  if (subscribers.error) logError("inbox.subscribers", subscribers.error);

  const tabClass = (active: boolean) => cn("h-9 rounded-sm px-3 text-sm leading-9", active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper");

  return (
    <>
      <PageHeader title="Inbox" description="Messages from the contact page and newsletter sign-ups." />
      <nav aria-label="Inbox" className="mb-4 flex gap-1">
        <Link href="/admin/inbox" aria-current={tab === "messages" ? "page" : undefined} className={tabClass(tab === "messages")}>
          Messages
        </Link>
        <Link href="/admin/inbox?tab=newsletter" aria-current={tab === "newsletter" ? "page" : undefined} className={tabClass(tab === "newsletter")}>
          Newsletter ({subscribers.count ?? 0})
        </Link>
      </nav>

      {tab === "messages" ? (
        <>
          <p className="mb-3 text-sm">
            <Link href={showHandled ? "/admin/inbox" : "/admin/inbox?handled=1"} className="text-muted underline underline-offset-4 hover:text-ink">
              {showHandled ? "Show open messages" : "Show handled messages"}
            </Link>
          </p>
          {(messages.data ?? []).length === 0 ? (
            <EmptyState title={showHandled ? "Nothing handled yet." : "No new messages."} description="Messages sent from the contact page appear here." />
          ) : (
            <ul className="divide-y divide-line border border-line bg-paper">
              {messages.data!.map((m) => (
                <li key={m.id} className="space-y-2 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a href={`mailto:${m.email}`} className="text-sm font-medium underline underline-offset-4">
                      {m.email}
                    </a>
                    <span className="text-xs text-muted">{formatDateTime(m.created_at)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-line text-ink-soft">{m.message}</p>
                  <div className="flex gap-2">
                    <a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message")}`} className="inline-flex h-9 items-center rounded-sm border border-line-strong px-3 text-sm hover:bg-mist">
                      Reply by email
                    </a>
                    <HandledToggle id={m.id} handled={m.handled} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (subscribers.data ?? []).length === 0 ? (
        <EmptyState title="No sign-ups yet." description="People who join the newsletter from the site footer appear here." />
      ) : (
        <>
          <div className="mb-3">
            <CopyEmails emails={subscribers.data!.map((s) => s.email)} />
          </div>
          <ul className="divide-y divide-line border border-line bg-paper">
            {subscribers.data!.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="truncate text-sm">{s.email}</span>
                <span className="flex items-center gap-2">
                  <Badge>{formatDate(s.created_at)}</Badge>
                  {user.role === "admin" && <RemoveSubscriber id={s.id} />}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
