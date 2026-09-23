-- Local development seed only (`supabase db reset`). Not applied to hosted
-- projects by `supabase db push`. Real zones and fees are managed in
-- /admin/settings.
insert into public.delivery_zones (name, description, fee_minor, estimated_days, sort_order) values
  ('Accra & Tema', 'Greater Accra Region', 3000, '1-2 days', 1),
  ('Kumasi', 'Ashanti Region', 5000, '2-3 days', 2),
  ('Other regions', 'All other regions of Ghana', 7000, '3-5 days', 3)
on conflict (name) do nothing;
