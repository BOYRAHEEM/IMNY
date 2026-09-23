import { z } from "zod";

/**
 * Public configuration, safe in browser bundles.
 * NEXT_PUBLIC_* values are inlined at build time, so each must be referenced
 * explicitly (not via dynamic process.env lookups).
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().transform((u) => u.replace(/\/+$/, "")),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
