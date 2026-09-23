import "server-only";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/errors";

/** Best-effort client IP (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Returns true if the action may proceed. Fails OPEN on infrastructure errors
 * so an outage of the limiter never locks everyone out; Supabase Auth has its
 * own limits as a backstop.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createServiceClient().rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    logError("rateLimit", err);
    return true;
  }
}
