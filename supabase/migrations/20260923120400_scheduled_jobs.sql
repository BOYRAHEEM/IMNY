-- =============================================================================
-- Scheduled jobs (pg_cron, available on all Supabase plans).
-- The app also releases expired holds before each checkout, so these are a
-- safety net rather than the only mechanism.
-- =============================================================================

create extension if not exists pg_cron;

select cron.schedule(
  'release-expired-reservations',
  '* * * * *',
  $$select public.release_expired_reservations()$$
);

select cron.schedule(
  'purge-rate-limits',
  '17 * * * *',
  $$delete from public.rate_limits where window_start < now() - interval '1 day'$$
);
