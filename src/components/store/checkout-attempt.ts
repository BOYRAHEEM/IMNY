"use client";

/**
 * One idempotency key per checkout attempt. Re-submitting the same details
 * (double tap, lost connection, refresh) reuses the key, so the server
 * returns the order it already placed instead of creating a second one.
 * Changing anything starts a new attempt.
 */

const KEY = "imny-checkout-attempt";

let memory: { fp: string; key: string } | null = null;

/** Short fingerprint of the submission, so personal details aren't stored. */
function fingerprint(submission: unknown): string {
  const s = JSON.stringify(submission);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36) + s.length.toString(36);
}

export function attemptKey(submission: unknown): string {
  const fp = fingerprint(submission);
  let saved = memory;
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") ?? memory;
  } catch {}
  if (saved?.fp === fp && saved.key) return saved.key;

  memory = { fp, key: crypto.randomUUID() };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(memory));
  } catch {}
  return memory.key;
}

/** The server gave a definite answer, so the next submit is a new attempt. */
export function endAttempt() {
  memory = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}
