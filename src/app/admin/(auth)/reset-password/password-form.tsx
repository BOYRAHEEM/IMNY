"use client";

import { useActionState } from "react";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { setNewPassword } from "../actions";

export function PasswordForm() {
  const [result, action] = useActionState(setNewPassword, null);
  return (
    <form action={action} className="space-y-5">
      <FormMessage result={result} />
      <Field label="Password" htmlFor="password" hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="Confirm password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <SubmitButton className="w-full" pendingText="Saving…">
        Save password
      </SubmitButton>
    </form>
  );
}
