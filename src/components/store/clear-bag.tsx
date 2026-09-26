"use client";

import { useEffect } from "react";
import { cart } from "./cart-store";
import { endAttempt } from "./checkout-attempt";
import { clearPrefs } from "./checkout-prefs";

/** Empties the bag once an order has gone through. */
export function ClearBag() {
  useEffect(() => {
    cart.clear();
    clearPrefs();
    // The next checkout is a new order, even with identical details.
    endAttempt();
  }, []);
  return null;
}
