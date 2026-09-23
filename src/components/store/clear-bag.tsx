"use client";

import { useEffect } from "react";
import { cart } from "./cart-store";
import { clearPrefs } from "./checkout-prefs";

/** Empties the bag once an order has gone through. */
export function ClearBag() {
  useEffect(() => {
    cart.clear();
    clearPrefs();
  }, []);
  return null;
}
