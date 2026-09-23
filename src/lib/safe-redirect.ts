/**
 * Only allow redirects to paths inside the admin area. Email links carry a
 * `next` parameter; this stops them being abused to send people off-site.
 */
export function safeAdminNext(next: string | null | undefined, fallback = "/admin"): string {
  const s = next ?? "";
  return /^\/admin(\/[\w\-/?=&%.]*)?$/.test(s) && !s.startsWith("/admin/login") ? s : fallback;
}
