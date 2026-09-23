-- Editable brand copy (homepage, about, contact, policies). Keys missing here
-- fall back to defaults in the app, so the owner only stores what she changes.
alter table public.store_settings
  add column content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object' and pg_column_size(content) < 20000);
