"use client";

const KEY = "imny-checkout-prefs";

export type CheckoutPrefs = { code?: string };

export function readPrefs(): CheckoutPrefs {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function writePrefs(p: CheckoutPrefs) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

export function clearPrefs() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}
