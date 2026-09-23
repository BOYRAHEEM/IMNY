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
  { href: "/admin/settings", label: "Settings", icon: "settings", adminOnly: true },
];

type ShellUser = { email: string; name: string | null; role: "admin" | "staff" | "customer" };

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
            "flex h-11 items-center gap-3 rounded-sm px-3 text-sm transition-colors lg:h-10",
            isActive(item.href) ? "bg-ink text-paper" : "text-ink-soft hover:bg-mist hover:text-ink",
          )}
        >
          <Icon name={item.icon} className="size-[18px] shrink-0" />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const account = (
    <div className="border-t border-line pt-4">
      <p className="truncate px-3 text-sm font-medium">{user.name || user.email}</p>
      <p className="px-3 text-xs text-muted capitalize">{user.role}</p>
      <div className="mt-3 flex flex-col gap-0.5">
        <Link href="/" target="_blank" className="flex h-10 items-center gap-3 rounded-sm px-3 text-sm text-ink-soft hover:bg-mist">
          <Icon name="external" className="size-[18px]" /> View store
        </Link>
        <form action={adminSignOut}>
          <button type="submit" className="flex h-10 w-full items-center gap-3 rounded-sm px-3 text-sm text-ink-soft hover:bg-mist">
            <Icon name="logout" className="size-[18px]" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-mist lg:grid lg:grid-cols-[240px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between border-r border-line bg-paper p-4 lg:flex">
        <div>
          <Link href="/admin" className="mb-6 block px-3 pt-2 font-display text-2xl tracking-wide">
            {storeName}
          </Link>
          {nav}
        </div>
        {account}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper px-4 lg:hidden">
        <Link href="/admin" className="font-display text-xl tracking-wide">
          {storeName}
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="admin-mobile-nav"
          className="-mr-2 flex size-11 items-center justify-center rounded-sm hover:bg-mist"
        >
          <Icon name="menu" className="size-5" />
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
            "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col justify-between overflow-y-auto bg-paper p-4 transition-transform",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div>
            <div className="mb-4 flex items-center justify-between">
              <span className="px-3 font-display text-xl tracking-wide">{storeName}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-11 items-center justify-center rounded-sm hover:bg-mist"
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

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
