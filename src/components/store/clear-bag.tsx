"use client";

import { useEffect } from "react";
import { cart } from "./cart-store";

/** Empties the bag once an order has gone through. */
export function ClearBag() {
  useEffect(() => {
    cart.clear();
    try {
      sessionStorage.removeItem("imny-checkout-prefs");
    } catch {}
  }, []);
  return null;
}
