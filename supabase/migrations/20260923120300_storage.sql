-- =============================================================================
-- Storage: public "catalog" bucket for product and category images.
-- Anyone can view files by URL; only staff/admin can upload, replace or delete.
-- Size and type limits are enforced by Storage itself, not just the browser.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog',
  'catalog',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy catalog_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'catalog' and (select public.is_staff()));

create policy catalog_staff_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'catalog'
    and (select public.is_staff())
    and (storage.foldername(name))[1] in ('products', 'categories', 'site')
  );

create policy catalog_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'catalog' and (select public.is_staff()))
  with check (bucket_id = 'catalog' and (select public.is_staff()));

create policy catalog_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalog' and (select public.is_staff()));
