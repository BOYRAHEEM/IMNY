"use client";

import { useSyncExternalStore } from "react";

/**
 * The shopping bag lives in localStorage and holds ONLY variant ids and
 * quantities. Names, prices and stock are always fetched from the server,
 * which re-checks everything at checkout, so editing this storage can't
 * change what anyone pays.
 */

export type CartLine = { variant_id: string; quantity: number };

const KEY = "imny-bag-v1";
const EVENT = "imny-bag-change";
export const MAX_LINES = 50;

const EMPTY: CartLine[] = [];
let cachedRaw: string | null = null;
let cached: CartLine[] = EMPTY;

function read(): CartLine[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cached; // storage blocked (private mode etc.)
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw ?? "[]");
    cached = Array.isArray(parsed)
      ? parsed
          .filter((l) => typeof l?.variant_id === "string" && /^[0-9a-f-]{36}$/i.test(l.variant_id) && Number.isInteger(l.quantity) && l.quantity > 0)
          .slice(0, MAX_LINES)
      : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function write(lines: CartLine[]) {
  const clean = lines.filter((l) => l.quantity > 0).slice(0, MAX_LINES);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    // Storage unavailable: keep an in-memory bag for this tab.
    cachedRaw = JSON.stringify(clean);
    cached = clean;
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage); // other tabs
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

const noopSubscribe = () => () => {};
/** False during server render and hydration, true once running in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useCartCount(): number {
  return useCart().reduce((n, l) => n + l.quantity, 0);
}

export const cart = {
  /** Add units, capped at `max` for that line. Returns the new line quantity. */
  add(variant_id: string, quantity: number, max: number): number {
    const lines = [...read()];
    const existing = lines.find((l) => l.variant_id === variant_id);
    const next = Math.max(0, Math.min(max, (existing?.quantity ?? 0) + quantity));
    if (existing) existing.quantity = next;
    else lines.push({ variant_id, quantity: next });
    write(lines.map((l) => ({ ...l })));
    return next;
  },
  set(variant_id: string, quantity: number) {
    write(read().map((l) => (l.variant_id === variant_id ? { ...l, quantity } : l)));
  },
  replace(oldVariantId: string, newVariantId: string) {
    const lines = read();
    const moving = lines.find((l) => l.variant_id === oldVariantId);
    if (!moving) return;
    const merged = lines
      .filter((l) => l.variant_id !== oldVariantId)
      .map((l) => (l.variant_id === newVariantId ? { ...l, quantity: l.quantity + moving.quantity } : l));
    if (!merged.some((l) => l.variant_id === newVariantId)) merged.push({ variant_id: newVariantId, quantity: moving.quantity });
    write(merged);
  },
  remove(variant_id: string) {
    write(read().filter((l) => l.variant_id !== variant_id));
  },
  clear() {
    write([]);
  },
};
