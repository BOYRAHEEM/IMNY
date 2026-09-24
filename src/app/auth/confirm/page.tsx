"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Spinner } from "@/components/ui/spinner";
import { safeAdminNext } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/client";

/**
 * Landing page for invitation and password-reset emails. Supabase can send
 * the session three ways; handle each, then continue inside the admin area.
 *   #access_token=…&refresh_token=…  (invites sent from the server)
 *   ?token_hash=…&type=…              (custom email templates)
 *   ?code=…                           (PKCE, e.g. "forgot password")
 */
export default function ConfirmPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const next = safeAdminNext(query.get("next"));
    const supabase = createClient();

    async function run() {
      const failed = hash.get("error_description") ?? query.get("error_description");
      if (failed) throw new Error(failed);

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const tokenHash = query.get("token_hash");
      const type = query.get("type") as EmailOtpType | null;
      const code = query.get("code");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) throw error;
      } else if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) throw error;
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else {
        throw new Error("missing token");
      }
      // Don't leave tokens in the address bar or history.
      window.history.replaceState(null, "", window.location.pathname);
      router.replace(next);
    }

    run().catch((err) => {
      console.error("[auth.confirm]", err);
      setError("This link has expired or was already used.");
    });
  }, [router]);

  return (
    <main className="imny-admin flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-paper p-8 text-center">
        {error ? (
          <>
            <p className="font-medium">{error}</p>
            <p className="mt-2 text-sm text-muted">Ask an admin to send a new invitation, or reset your password.</p>
            <Link href="/admin/forgot-password" className="mt-6 inline-block text-sm underline underline-offset-4">
              Reset password
            </Link>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm text-muted">
            <Spinner /> Signing you in…
          </p>
        )}
      </div>
    </main>
  );
}
