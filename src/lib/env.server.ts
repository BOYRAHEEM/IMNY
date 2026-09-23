import "server-only";
import { z } from "zod";

/**
 * Server-only secrets. Importing this file from a Client Component fails the
 * build (via "server-only"), so secrets cannot leak into browser bundles.
 * Values are read lazily so a missing optional secret only fails the feature
 * that needs it.
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  PAYSTACK_SECRET_KEY: z.string().regex(/^sk_(test|live)_/, "Must be a Paystack secret key"),
  ORDER_LINK_SECRET: z.string().min(32, "Use at least 32 random characters"),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
});

type ServerEnv = z.infer<typeof serverSchema>;

export function serverEnv<K extends keyof ServerEnv>(key: K): ServerEnv[K] {
  const parsed = serverSchema.shape[key].safeParse(process.env[key] || undefined);
  if (!parsed.success) {
    throw new Error(`Server environment variable ${key} is missing or invalid.`);
  }
  return parsed.data as ServerEnv[K];
}
