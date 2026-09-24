import type { Metadata } from "next";
import { getStoreName } from "@/lib/queries/settings";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function AdminAuthLayout({ children }: LayoutProps<"/admin">) {
  const storeName = await getStoreName();
  return (
    <main className="imny-admin flex min-h-dvh items-start justify-center px-4 pt-[12vh] pb-12 sm:items-center sm:pt-0">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-[clamp(56px,14vw,84px)] leading-[0.8] font-bold tracking-[-0.08em]">{storeName}</p>
          <p className="mt-3 font-mono text-[10px] font-medium tracking-[0.3em] text-label">OWNER DASHBOARD</p>
        </div>
        <div className="rounded-3xl border border-line bg-paper p-6 shadow-[0_20px_40px_-28px_rgba(20,18,15,0.18)] sm:p-8">{children}</div>
      </div>
    </main>
  );
}
