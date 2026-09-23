"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { adminSignIn } from "../actions";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [result, action] = useActionState(adminSignIn, null);

  return (
    <form action={action} className="space-y-5">
      <FormMessage result={result ?? (notice ? { ok: false, error: notice } : null)} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus inputMode="email" />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/admin/forgot-password" className="text-muted underline underline-offset-4 hover:text-ink">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
