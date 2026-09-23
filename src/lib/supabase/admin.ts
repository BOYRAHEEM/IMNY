import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

/**
 * Service-role client. BYPASSES Row Level Security.
 *
 * Only for operations the server performs on its own authority after doing
 * its own checks: placing orders, confirming payments, guest order lookups by
 * token, rate limiting. Never use it to serve a request "as" a user; use
 * lib/supabase/server.ts for that.
 */
export function createServiceClient() {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
