"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getQuote } from "@/app/(store)/checkout/actions";
import type { Quote } from "@/lib/checkout/quote";
import { cart, type CartLine } from "./cart-store";

/**
 * Keeps a server-computed quote in sync with the bag. Quantities that exceed
 * current stock are corrected in the bag automatically, with a notice.
 */
export function useQuote(lines: CartLine[], opts: { zoneId?: string | null; code?: string | null; email?: string | null } = {}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);

  const key = JSON.stringify([lines, opts.zoneId ?? null, opts.code ?? null, opts.email ?? null]);

  useEffect(() => {
    if (lines.length === 0) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await getQuote({ lines, zoneId: opts.zoneId, code: opts.code, email: opts.email });
        if (id !== requestId.current) return; // a newer request superseded this one
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        const fixes: string[] = [];
        for (const l of result.quote.lines) {
          const name = [l.product_name, l.variant_title].filter(Boolean).join(" — ");
          if ((l.status === "insufficient_stock" || l.status === "quantity_limit") && l.available > 0) {
            cart.set(l.variant_id, l.available);
            fixes.push(`${name}: only ${l.available} available, so we updated your bag.`);
          }
        }
        if (fixes.length) setNotices(fixes);
        setQuote(result.quote);
      });
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures every input
  }, [key]);

  return { quote: lines.length ? quote : null, error, notices, loading: pending || (lines.length > 0 && !quote && !error) };
}
