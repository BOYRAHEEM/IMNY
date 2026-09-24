"use client";

import { useActionState } from "react";
import { ui } from "@/components/store/ui";
import { sendContactMessage } from "../actions";

export function ContactForm() {
  const [state, action, pending] = useActionState(sendContactMessage, null);

  if (state?.ok) {
    return (
      <p role="status" className="m-0 max-w-[460px] text-[clamp(20px,3vw,30px)] font-bold tracking-[-0.03em]">
        got it. we&apos;ll get back to you within 24hrs.
      </p>
    );
  }

  return (
    <form action={action} className="flex max-w-[460px] flex-col gap-3">
      <label htmlFor="contact-email" className={ui.label()}>
        drop us a message
      </label>
      <input id="contact-email" name="email" type="email" required autoComplete="email" placeholder="email" aria-label="Your email" className={ui.input(false, "text-xs")} />
      <textarea
        name="message"
        required
        rows={5}
        maxLength={4000}
        placeholder="message"
        aria-label="Your message"
        className={ui.input(false, "resize-y text-xs")}
      />
      <input name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {state && !state.ok && (
        <p role="alert" className="m-0 font-mono text-xs text-bad">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={ui.cta("mt-2 self-start sm:px-10 sm:py-[17px] sm:tracking-[0.26em]")}>
        {pending ? "SENDING…" : "SEND"}
      </button>
    </form>
  );
}
