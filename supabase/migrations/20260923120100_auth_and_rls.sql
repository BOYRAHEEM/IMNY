-- =============================================================================
-- Authorization: role helpers, Row Level Security and table privileges.
--
-- Layers of defence:
--   1. Table/column GRANTs decide which operations a client role can attempt.
--   2. RLS policies decide which rows those operations may touch.
--   3. Business operations (checkout, payments, stock) are SECURITY DEFINER
--      functions that re-check the caller's role and cannot be bypassed by
--      writing to tables directly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so they can read profiles regardless of the
-- caller's RLS; they only ever answer about the current user.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('staff', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Privileges. Start from nothing for client roles, then grant explicitly.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Functions created by later migrations are private unless granted explicitly.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- Public catalogue (rows further limited by RLS)
grant select on public.store_settings, public.categories, public.products, public.product_options,
  public.product_option_values, public.product_variants, public.product_images, public.delivery_zones
  to anon, authenticated;

-- Catalogue management (RLS restricts to staff/admin)
grant insert, update, delete on public.categories, public.products, public.product_options,
  public.product_option_values, public.product_variants, public.product_images, public.delivery_zones
  to authenticated;
grant update on public.store_settings to authenticated;

-- Customer self-service: only name and phone are editable. Never role or email.
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;

-- Staff read access (RLS restricts to staff), plus narrowly-scoped writes
grant select on public.customers, public.inventory, public.inventory_movements, public.orders,
  public.order_items, public.order_status_history, public.order_notes, public.discount_codes,
  public.discount_redemptions, public.payment_events
  to authenticated;
grant update (full_name, phone) on public.customers to authenticated;
grant update (low_stock_threshold) on public.inventory to authenticated;
grant insert (order_id, body) on public.order_notes to authenticated;

-- Discounts: usage_count is maintained by the database only.
grant insert (code, description, type, value, max_discount_minor, min_order_minor, starts_at,
  expires_at, usage_limit, per_customer_limit, is_active) on public.discount_codes to authenticated;
grant update (code, description, type, value, max_discount_minor, min_order_minor, starts_at,
  expires_at, usage_limit, per_customer_limit, is_active) on public.discount_codes to authenticated;
grant delete on public.discount_codes to authenticated;

-- orders, order_items, inventory quantities, redemptions, payment_events and
-- rate_limits have NO client write privileges: they change only through
-- database functions.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.store_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_options enable row level security;
alter table public.product_option_values enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.product_images enable row level security;
alter table public.discount_codes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_notes enable row level security;
alter table public.discount_redemptions enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.payment_events enable row level security;
alter table public.rate_limits enable row level security;

-- ---------------------------------------------------------------------------
-- Policies
-- (select fn()) wrappers let Postgres evaluate the helper once per query.
-- ---------------------------------------------------------------------------

-- store_settings
create policy store_settings_read on public.store_settings
  for select to anon, authenticated using (true);
create policy store_settings_admin_update on public.store_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- profiles
create policy profiles_read on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- customers
create policy customers_read on public.customers
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy customers_staff_update on public.customers
  for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- addresses: owners manage their own; staff can read
create policy addresses_read on public.addresses
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy addresses_insert_own on public.addresses
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy addresses_update_own on public.addresses
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy addresses_delete_own on public.addresses
  for delete to authenticated using (user_id = (select auth.uid()));

-- delivery_zones
create policy delivery_zones_read on public.delivery_zones
  for select to anon, authenticated using (is_active or (select public.is_staff()));
create policy delivery_zones_admin_insert on public.delivery_zones
  for insert to authenticated with check ((select public.is_admin()));
create policy delivery_zones_admin_update on public.delivery_zones
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy delivery_zones_admin_delete on public.delivery_zones
  for delete to authenticated using ((select public.is_admin()));

-- categories
create policy categories_read on public.categories
  for select to anon, authenticated using (is_active or (select public.is_staff()));
create policy categories_staff_insert on public.categories
  for insert to authenticated with check ((select public.is_staff()));
create policy categories_staff_update on public.categories
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy categories_admin_delete on public.categories
  for delete to authenticated using ((select public.is_admin()));

-- products: public sees only active products; drafts/archived are staff-only
create policy products_read on public.products
  for select to anon, authenticated using (status = 'active' or (select public.is_staff()));
create policy products_staff_insert on public.products
  for insert to authenticated with check ((select public.is_staff()));
create policy products_staff_update on public.products
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy products_admin_delete on public.products
  for delete to authenticated using ((select public.is_admin()));

-- product_options
create policy product_options_read on public.product_options
  for select to anon, authenticated
  using (
    (select public.is_staff())
    or exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
  );
create policy product_options_staff_insert on public.product_options
  for insert to authenticated with check ((select public.is_staff()));
create policy product_options_staff_update on public.product_options
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy product_options_staff_delete on public.product_options
  for delete to authenticated using ((select public.is_staff()));

-- product_option_values
create policy product_option_values_read on public.product_option_values
  for select to anon, authenticated
  using (
    (select public.is_staff())
    or exists (
      select 1 from public.product_options o
      join public.products p on p.id = o.product_id
      where o.id = option_id and p.status = 'active'
    )
  );
create policy product_option_values_staff_insert on public.product_option_values
  for insert to authenticated with check ((select public.is_staff()));
create policy product_option_values_staff_update on public.product_option_values
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy product_option_values_staff_delete on public.product_option_values
  for delete to authenticated using ((select public.is_staff()));

-- product_variants: inactive variants are hidden from shoppers
create policy product_variants_read on public.product_variants
  for select to anon, authenticated
  using (
    (select public.is_staff())
    or (is_active and exists (select 1 from public.products p where p.id = product_id and p.status = 'active'))
  );
create policy product_variants_staff_insert on public.product_variants
  for insert to authenticated with check ((select public.is_staff()));
create policy product_variants_staff_update on public.product_variants
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy product_variants_staff_delete on public.product_variants
  for delete to authenticated using ((select public.is_staff()));

-- product_images
create policy product_images_read on public.product_images
  for select to anon, authenticated
  using (
    (select public.is_staff())
    or exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
  );
create policy product_images_staff_insert on public.product_images
  for insert to authenticated with check ((select public.is_staff()));
create policy product_images_staff_update on public.product_images
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy product_images_staff_delete on public.product_images
  for delete to authenticated using ((select public.is_staff()));

-- inventory: exact stock levels are staff-only; shoppers get availability via
-- public.variant_availability(). Quantities change only via functions.
create policy inventory_staff_read on public.inventory
  for select to authenticated using ((select public.is_staff()));
create policy inventory_staff_update on public.inventory
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

create policy inventory_movements_staff_read on public.inventory_movements
  for select to authenticated using ((select public.is_staff()));

-- discount codes: staff can view, only admins change
create policy discount_codes_staff_read on public.discount_codes
  for select to authenticated using ((select public.is_staff()));
create policy discount_codes_admin_insert on public.discount_codes
  for insert to authenticated with check ((select public.is_admin()));
create policy discount_codes_admin_update on public.discount_codes
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy discount_codes_admin_delete on public.discount_codes
  for delete to authenticated using ((select public.is_admin()));

create policy discount_redemptions_staff_read on public.discount_redemptions
  for select to authenticated using ((select public.is_staff()));

-- orders: customers see only their own; staff see all. No client writes.
create policy orders_read on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy order_items_read on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_staff()))
    )
  );

create policy order_status_history_staff_read on public.order_status_history
  for select to authenticated using ((select public.is_staff()));

create policy order_notes_staff_read on public.order_notes
  for select to authenticated using ((select public.is_staff()));
create policy order_notes_staff_insert on public.order_notes
  for insert to authenticated
  with check ((select public.is_staff()) and author_id = (select auth.uid()));

-- payment events: admin only
create policy payment_events_admin_read on public.payment_events
  for select to authenticated using ((select public.is_admin()));

-- rate_limits: no policies -> no client access at all.
