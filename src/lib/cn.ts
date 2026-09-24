import { twMerge } from "tailwind-merge";

/**
 * Join class names, skipping falsy values. Conflicting Tailwind classes are
 * resolved so the LATER one wins (e.g. a page's override of a shared button).
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return twMerge(classes.filter(Boolean).join(" "));
}
