-- =============================================================================
-- Core schema
--
-- Conventions
--   * Money is stored as integer minor units (pesewas for GHS) in bigint columns.
--     Never floats. The currency lives in store_settings and is snapshotted on
--     each order.
--   * Emails are stored lower-cased; SKUs and discount codes upper-cased.
--   * Product options are generic (Size, Colour, Length, ...) with up to three
--     per product. A variant references at most one value per option, so a
--     product can have sizes only, colours only, both, or nothing (one-size).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'staff', 'admin');
create type public.product_status as enum ('draft', 'active', 'archived');
create type public.order_status as enum (
  'pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'cancelled'
);
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.discount_type as enum ('percentage', 'fixed');
-- Lifecycle of the stock attached to an order:
--   reserved  -> held while the customer pays (counts against availability)
--   committed -> payment confirmed, stock permanently deducted
--   released  -> reservation returned to available stock (expired/failed/cancelled)
create type public.stock_state as enum ('reserved', 'committed', 'released');
create type public.inventory_reason as enum (
  'initial',
  'restock',
  'manual_adjustment',
  'return',
  'order_reserved',
  'reservation_released',
  'order_committed',
  'order_cancelled_restock'
);

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Store settings (single row)
-- ---------------------------------------------------------------------------
create table public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'IMNY' check (char_length(store_name) between 1 and 80),
  tagline text check (char_length(tagline) <= 160),
  contact_email text check (char_length(contact_email) <= 254),
  contact_phone text check (char_length(contact_phone) <= 32),
  whatsapp_number text check (char_length(whatsapp_number) <= 32),
  business_address text check (char_length(business_address) <= 300),
  currency char(3) not null default 'GHS' check (currency ~ '^[A-Z]{3}$'),
  order_prefix text not null default 'IM' check (order_prefix ~ '^[A-Z0-9]{1,6}$'),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  reservation_minutes integer not null default 30 check (reservation_minutes between 5 and 240),
  max_quantity_per_item integer not null default 10 check (max_quantity_per_item between 1 and 100),
  free_delivery_over_minor bigint check (free_delivery_over_minor >= 0),
  allow_guest_checkout boolean not null default true,
  announcement text check (char_length(announcement) <= 200),
  social_links jsonb not null default '{}'::jsonb check (jsonb_typeof(social_links) = 'object'),
  seo_title text check (char_length(seo_title) <= 120),
  seo_description text check (char_length(seo_description) <= 320),
  updated_at timestamptz not null default now()
);

create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function public.set_updated_at();

insert into public.store_settings default values;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user) and roles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (email = lower(email)),
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 32),
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role) where role <> 'customer';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile for every new auth user. The role is ALWAYS 'customer';
-- user-supplied metadata is never trusted for authorization.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    left(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 120)
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(coalesce(new.email, '')) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Customers: everyone who has ever ordered, including guests.
-- Linked to an account only once that account's email is verified.
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete set null,
  email text not null unique check (email = lower(email) and char_length(email) <= 254),
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Delivery zones
-- ---------------------------------------------------------------------------
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 300),
  fee_minor bigint not null check (fee_minor >= 0),
  free_over_minor bigint check (free_over_minor >= 0),
  estimated_days text check (char_length(estimated_days) <= 40),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger delivery_zones_updated_at before update on public.delivery_zones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Addresses (saved by signed-in customers)
-- ---------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text check (char_length(label) <= 40),
  recipient_name text not null check (char_length(recipient_name) between 1 and 120),
  phone text not null check (char_length(phone) between 1 and 32),
  line1 text not null check (char_length(line1) between 1 and 200),
  line2 text check (char_length(line2) <= 200),
  city text not null check (char_length(city) between 1 and 80),
  region text not null check (char_length(region) between 1 and 80),
  digital_address text check (char_length(digital_address) <= 20),
  landmark text check (char_length(landmark) <= 200),
  delivery_zone_id uuid references public.delivery_zones (id) on delete set null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default on public.addresses (user_id) where is_default;

create trigger addresses_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  description text check (char_length(description) <= 2000),
  parent_id uuid references public.categories (id) on delete set null,
  image_path text check (char_length(image_path) <= 512),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  seo_title text check (char_length(seo_title) <= 120),
  seo_description text check (char_length(seo_description) <= 320),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_not_own_parent check (parent_id is null or parent_id <> id)
);

create index categories_parent_idx on public.categories (parent_id);

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 200),
  description text check (char_length(description) <= 10000),
  category_id uuid references public.categories (id) on delete set null,
  status public.product_status not null default 'draft',
  featured boolean not null default false,
  seo_title text check (char_length(seo_title) <= 120),
  seo_description text check (char_length(seo_description) <= 320),
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products (category_id);
create index products_status_published_idx on public.products (status, published_at desc);
create index products_featured_idx on public.products (featured) where featured and status = 'active';
create index products_search_idx on public.products using gin (search);

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create or replace function public.products_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(new.created_by, auth.uid());
  end if;
  if new.status = 'active' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger products_before_write before insert or update on public.products
  for each row execute function public.products_before_write();

-- ---------------------------------------------------------------------------
-- Product options (e.g. Size, Colour) and their values (e.g. S/M/L, Black)
-- ---------------------------------------------------------------------------
create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  position smallint not null check (position between 1 and 3),
  created_at timestamptz not null default now(),
  constraint product_options_position_unique unique (product_id, position) deferrable initially deferred,
  constraint product_options_name_unique unique (product_id, name)
);

create table public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.product_options (id) on delete cascade,
  value text not null check (char_length(value) between 1 and 40),
  swatch_hex text check (swatch_hex ~ '^#[0-9A-Fa-f]{6}$'),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint product_option_values_unique unique (option_id, value)
);

create index product_option_values_option_idx on public.product_option_values (option_id);

-- ---------------------------------------------------------------------------
-- Variants: the purchasable unit. Price and SKU live here.
-- ---------------------------------------------------------------------------
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text unique check (sku = upper(sku) and char_length(sku) between 1 and 64),
  price_minor bigint not null check (price_minor >= 0),
  compare_at_price_minor bigint check (compare_at_price_minor is null or compare_at_price_minor > price_minor),
  -- NO ACTION (not RESTRICT) so deleting a product cascades cleanly in one statement.
  option1_value_id uuid references public.product_option_values (id),
  option2_value_id uuid references public.product_option_values (id),
  option3_value_id uuid references public.product_option_values (id),
  is_active boolean not null default true,
  position integer not null default 0,
  weight_grams integer check (weight_grams >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_options_contiguous check (
    (option2_value_id is null or option1_value_id is not null) and
    (option3_value_id is null or option2_value_id is not null)
  ),
  -- One variant per combination. NULLS NOT DISTINCT means a one-size product
  -- (all NULL) can only have a single variant.
  constraint product_variants_combination_unique
    unique nulls not distinct (product_id, option1_value_id, option2_value_id, option3_value_id)
);

create index product_variants_product_idx on public.product_variants (product_id);

create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

-- Each option value on a variant must belong to this product's option at the
-- matching position, and the variant must specify one value per option.
create or replace function public.validate_variant_options()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_option_count integer;
  v_given integer;
  v_invalid integer;
begin
  select count(*) into v_option_count
  from public.product_options where product_id = new.product_id;

  v_given := (new.option1_value_id is not null)::int
           + (new.option2_value_id is not null)::int
           + (new.option3_value_id is not null)::int;

  if v_given <> v_option_count then
    raise exception 'VARIANT_OPTIONS_MISMATCH'
      using detail = format('Product has %s option(s); variant specifies %s.', v_option_count, v_given);
  end if;

  select count(*) into v_invalid
  from (values (1, new.option1_value_id), (2, new.option2_value_id), (3, new.option3_value_id)) as g (pos, value_id)
  where g.value_id is not null
    and not exists (
      select 1
      from public.product_option_values ov
      join public.product_options o on o.id = ov.option_id
      where ov.id = g.value_id and o.product_id = new.product_id and o.position = g.pos
    );

  if v_invalid > 0 then
    raise exception 'VARIANT_OPTION_INVALID';
  end if;

  return new;
end;
$$;

create trigger product_variants_validate_options
  before insert or update of product_id, option1_value_id, option2_value_id, option3_value_id
  on public.product_variants
  for each row execute function public.validate_variant_options();

-- ---------------------------------------------------------------------------
-- Inventory: one row per variant. available = on_hand - reserved.
-- Direct writes are blocked for clients; changes go through functions that
-- record every movement.
-- ---------------------------------------------------------------------------
create table public.inventory (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  low_stock_threshold integer check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now(),
  constraint inventory_reserved_within_on_hand check (reserved <= on_hand)
);

create or replace function public.create_inventory_for_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory (variant_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger product_variants_create_inventory after insert on public.product_variants
  for each row execute function public.create_inventory_for_variant();

-- A variant holding stock for an unpaid order must not be deleted (it would
-- silently lose the reservation). Deactivate it instead.
create or replace function public.prevent_delete_reserved_variant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.inventory where variant_id = old.id and reserved > 0) then
    raise exception 'VARIANT_HAS_RESERVATIONS'
      using detail = 'This variant has stock reserved for pending orders. Deactivate it instead.';
  end if;
  return old;
end;
$$;

create trigger product_variants_prevent_reserved_delete before delete on public.product_variants
  for each row execute function public.prevent_delete_reserved_variant();

-- ---------------------------------------------------------------------------
-- Product images (files live in Supabase Storage; only paths are stored here)
-- ---------------------------------------------------------------------------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null unique check (storage_path ~ '^products/' and char_length(storage_path) <= 512),
  alt_text text check (char_length(alt_text) <= 300),
  position integer not null default 0,
  is_primary boolean not null default false,
  -- Optional: tie the image to an option value (e.g. show black photos when Black is selected)
  option_value_id uuid references public.product_option_values (id) on delete set null,
  width integer check (width > 0),
  height integer check (height > 0),
  created_at timestamptz not null default now(),
  constraint product_images_position_unique unique (product_id, position) deferrable initially deferred
);

create unique index product_images_one_primary on public.product_images (product_id) where is_primary;

-- First image of a product becomes primary automatically.
create or replace function public.product_images_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.product_images where product_id = new.product_id and is_primary) then
    new.is_primary = true;
  end if;
  return new;
end;
$$;

create trigger product_images_before_insert before insert on public.product_images
  for each row execute function public.product_images_before_insert();

-- Deleting the primary image promotes the next one.
create or replace function public.product_images_after_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_primary then
    update public.product_images
    set is_primary = true
    where id = (
      select id from public.product_images
      where product_id = old.product_id
      order by position, created_at
      limit 1
    );
  end if;
  return null;
end;
$$;

create trigger product_images_after_delete after delete on public.product_images
  for each row execute function public.product_images_after_delete();

-- ---------------------------------------------------------------------------
-- Discount codes
-- ---------------------------------------------------------------------------
create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  description text check (char_length(description) <= 200),
  type public.discount_type not null,
  -- percentage: 1-100 (percent). fixed: amount in minor units.
  value bigint not null check (value > 0),
  max_discount_minor bigint check (max_discount_minor > 0),
  min_order_minor bigint not null default 0 check (min_order_minor >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer check (usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  per_customer_limit integer check (per_customer_limit > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discount_percentage_range check (type <> 'percentage' or value <= 100),
  constraint discount_dates_ordered check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create trigger discount_codes_updated_at before update on public.discount_codes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq start with 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.customers (id),
  user_id uuid references public.profiles (id) on delete set null,
  email text not null check (email = lower(email) and char_length(email) <= 254),
  phone text not null check (char_length(phone) between 1 and 32),

  -- Shipping snapshot (never changes when the customer edits saved addresses)
  shipping_name text not null check (char_length(shipping_name) between 1 and 120),
  shipping_line1 text not null check (char_length(shipping_line1) between 1 and 200),
  shipping_line2 text check (char_length(shipping_line2) <= 200),
  shipping_city text not null check (char_length(shipping_city) between 1 and 80),
  shipping_region text not null check (char_length(shipping_region) between 1 and 80),
  shipping_digital_address text check (char_length(shipping_digital_address) <= 20),
  delivery_instructions text check (char_length(delivery_instructions) <= 500),
  delivery_zone_id uuid references public.delivery_zones (id) on delete set null,
  delivery_zone_name text not null,

  -- Money (all computed in the database, never taken from the client)
  currency char(3) not null,
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  delivery_fee_minor bigint not null check (delivery_fee_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  discount_code_id uuid references public.discount_codes (id) on delete set null,
  discount_code text,

  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  payment_provider text not null check (char_length(payment_provider) <= 40),
  payment_reference text not null unique check (char_length(payment_reference) between 8 and 100),
  paid_at timestamptz,

  stock_state public.stock_state not null default 'reserved',
  reservation_expires_at timestamptz,

  -- SHA-256 (hex) of a random token given to the buyer, used for guest order
  -- lookups. The raw token is never stored.
  access_token_hash text not null check (access_token_hash ~ '^[0-9a-f]{64}$'),

  requires_attention boolean not null default false,
  attention_reason text,
  cancelled_at timestamptz,
  cancel_reason text check (char_length(cancel_reason) <= 300),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_discount_within_subtotal check (discount_minor <= subtotal_minor),
  constraint orders_total_consistent check (total_minor = subtotal_minor + delivery_fee_minor - discount_minor)
);

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_created_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_reservation_expiry_idx on public.orders (reservation_expires_at)
  where stock_state = 'reserved';
create index orders_attention_idx on public.orders (created_at desc) where requires_attention;

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- Purchase-time snapshot of each line. Prices here never change afterwards.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  product_slug text,
  variant_title text,
  options jsonb not null default '[]'::jsonb,
  sku text,
  image_path text,
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  quantity integer not null check (quantity > 0),
  line_total_minor bigint not null,
  created_at timestamptz not null default now(),
  constraint order_items_line_total check (line_total_minor = unit_price_minor * quantity)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_variant_idx on public.order_items (variant_id);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  from_payment_status public.payment_status,
  to_payment_status public.payment_status not null,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create or replace function public.record_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.status is distinct from old.status
     or new.payment_status is distinct from old.payment_status then
    insert into public.order_status_history (
      order_id, from_status, to_status, from_payment_status, to_payment_status, actor_id
    ) values (
      new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      case when tg_op = 'UPDATE' then old.payment_status end,
      new.payment_status,
      auth.uid()
    );
  end if;
  return null;
end;
$$;

create trigger orders_record_status after insert or update of status, payment_status on public.orders
  for each row execute function public.record_order_status_change();

-- Internal staff notes, kept apart from the order so customers never see them.
create table public.order_notes (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index order_notes_order_idx on public.order_notes (order_id, created_at);

create table public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discount_codes (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  email text not null,
  amount_minor bigint not null check (amount_minor >= 0),
  created_at timestamptz not null default now()
);

create index discount_redemptions_discount_email_idx on public.discount_redemptions (discount_id, email);

-- ---------------------------------------------------------------------------
-- Inventory ledger
-- ---------------------------------------------------------------------------
create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid references public.product_variants (id) on delete set null,
  delta_on_hand integer not null default 0,
  delta_reserved integer not null default 0,
  reason public.inventory_reason not null,
  order_id uuid references public.orders (id) on delete set null,
  note text check (char_length(note) <= 300),
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);
create index inventory_movements_order_idx on public.inventory_movements (order_id);

-- ---------------------------------------------------------------------------
-- Payment provider events (webhooks), stored for audit and idempotency
-- ---------------------------------------------------------------------------
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_type text not null,
  reference text,
  provider_event_id text,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  constraint payment_events_unique unique (provider, provider_event_id)
);

create index payment_events_reference_idx on public.payment_events (reference);

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window counters, server-only)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
