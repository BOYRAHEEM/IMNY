"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  const [result, action] = useActionState(requestPasswordReset, null);

  return (
    <>
      <h1 className="mb-2 text-2xl font-bold tracking-[-0.04em]">Reset your password</h1>
      <p className="mb-6 text-sm text-muted">We&apos;ll email you a link to choose a new one.</p>
      <form action={action} className="space-y-5">
        <FormMessage result={result} />
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="username" required inputMode="email" />
        </Field>
        <SubmitButton className="w-full" pendingText="Sending…">
          Send reset link
        </SubmitButton>
        <p className="text-center text-sm">
          <Link href="/admin/login" className="text-muted underline underline-offset-4 hover:text-ink">
            Back to sign in
          </Link>
        </p>
      </form>
    </>
  );
}
