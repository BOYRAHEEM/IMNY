"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { adminSignOut } from "@/app/admin/(auth)/actions";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icons";

type NavItem = { href: string; label: string; icon: IconName; adminOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "home" },
  { href: "/admin/orders", label: "Orders", icon: "bag" },
  { href: "/admin/products", label: "Products", icon: "tag" },
  { href: "/admin/inventory", label: "Inventory", icon: "boxes" },
  { href: "/admin/categories", label: "Categories", icon: "folder" },
  { href: "/admin/customers", label: "Customers", icon: "users" },
  { href: "/admin/discounts", label: "Discounts", icon: "percent" },
  { href: "/admin/lookbook", label: "Lookbook", icon: "image" },
  { href: "/admin/inbox", label: "Inbox", icon: "mail" },
  { href: "/admin/settings", label: "Settings", icon: "settings", adminOnly: true },
];

type ShellUser = { email: string; name: string | null; role: "admin" | "staff" | "customer" };

/** Store wordmark with the mono "owner" tag underneath. */
function Wordmark({ storeName, size = "lg" }: { storeName: string; size?: "lg" | "sm" }) {
  return (
    <span className="flex flex-col gap-0.5 leading-none">
      <span className={cn("font-bold tracking-[-0.06em]", size === "lg" ? "text-[28px]" : "text-[23px]")}>{storeName}</span>
      <span className="font-mono text-[9px] font-medium tracking-[0.2em] text-caption">OWNER DASHBOARD</span>
    </span>
  );
}

export function AdminShell({ storeName, user, children }: { storeName: string; user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((i) => !i.adminOnly || user.role === "admin");
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-0.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          onClick={() => setOpen(false)}
          className={cn(
            "flex h-11 items-center gap-3 rounded-full px-4 font-mono text-[13px] font-medium tracking-[0.04em] lowercase transition-colors lg:h-10",
            isActive(item.href) ? "bg-ink text-bone" : "text-ink-soft hover:bg-ink/[0.06] hover:text-ink",
          )}
        >
          <Icon name={item.icon} className="size-[18px] shrink-0" />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const account = (
    <div className="border-t border-rule-card pt-4">
      <p className="truncate px-4 text-sm font-semibold tracking-[-0.02em]">{user.name || user.email}</p>
      <p className="px-4 font-mono text-[10px] tracking-[0.18em] text-caption uppercase">{user.role}</p>
      <div className="mt-3 flex flex-col gap-1.5">
        <Link
          href="/"
          target="_blank"
          className="flex h-10 items-center justify-center gap-2 rounded-full bg-lime px-4 font-mono text-xs font-semibold tracking-[0.08em] transition-colors hover:bg-ink hover:text-bone"
        >
          view store <Icon name="external" className="size-4" />
        </Link>
        <form action={adminSignOut}>
          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-ink px-4 font-mono text-xs font-medium tracking-[0.08em] transition-colors hover:bg-ink hover:text-bone"
          >
            sign out <Icon name="logout" className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="imny-admin min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between gap-6 overflow-y-auto bg-sand p-4 lg:flex">
        <div>
          <Link href="/admin" className="mb-7 block px-4 pt-3">
            <Wordmark storeName={storeName} />
          </Link>
          {nav}
        </div>
        {account}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-sand/[0.88] px-4 backdrop-blur-md lg:hidden">
        <Link href="/admin">
          <Wordmark storeName={storeName} size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="admin-mobile-nav"
          className="flex h-10 items-center gap-2 rounded-full border border-ink px-4 font-mono text-xs font-medium tracking-[0.08em] hover:bg-ink hover:text-bone"
        >
          menu <Icon name="menu" className="size-4" />
          <span className="sr-only">Open menu</span>
        </button>
      </header>

      {/* Mobile drawer */}
      <div
        className={cn("fixed inset-0 z-40 lg:hidden", open ? "visible" : "invisible")}
        aria-hidden={!open}
      >
        <div
          className={cn("absolute inset-0 bg-ink/30 transition-opacity", open ? "opacity-100" : "opacity-0")}
          onClick={() => setOpen(false)}
        />
        <div
          id="admin-mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={cn(
            "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col justify-between gap-6 overflow-y-auto bg-sand p-4 transition-transform",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div>
            <div className="mb-5 flex items-center justify-between pl-4">
              <Wordmark storeName={storeName} size="sm" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-11 items-center justify-center rounded-full hover:bg-ink/[0.06]"
              >
                <Icon name="close" className="size-5" />
                <span className="sr-only">Close menu</span>
              </button>
            </div>
            {nav}
          </div>
          {account}
        </div>
      </div>

      <main className="min-w-0 animate-page-in px-4 py-6 sm:px-6 lg:px-12 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
