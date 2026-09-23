import type { Metadata } from "next";
import { getStoreName } from "@/lib/queries/settings";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function AdminAuthLayout({ children }: LayoutProps<"/admin">) {
  const storeName = await getStoreName();
  return (
    <main className="flex min-h-dvh items-start justify-center bg-mist px-4 pt-[12vh] pb-12 sm:items-center sm:pt-0">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center font-display text-3xl tracking-wide">{storeName}</p>
        <div className="border border-line bg-paper p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
