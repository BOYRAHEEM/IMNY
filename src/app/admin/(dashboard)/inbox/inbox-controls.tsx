"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removeSubscriber, setMessageHandled } from "./actions";

export function HandledToggle({ id, handled }: { id: string; handled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button variant={handled ? "ghost" : "secondary"} size="sm" disabled={pending} onClick={() => start(async () => void (await setMessageHandled(id, !handled)))}>
      {handled ? "Mark as open" : "Mark handled"}
    </Button>
  );
}

export function CopyEmails({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={!emails.length}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(emails.join(", "));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
    >
      {copied ? "Copied" : `Copy all ${emails.length} emails`}
    </Button>
  );
}

export function RemoveSubscriber({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <Button variant="danger" size="sm" disabled={pending} onClick={() => start(async () => void (await removeSubscriber(id)))}>
      Remove?
    </Button>
  ) : (
    <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
      Remove
    </Button>
  );
}
