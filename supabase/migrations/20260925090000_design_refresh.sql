-- =============================================================================
-- Storefront redesign support
--   * Pay on delivery (cash) for zones that allow it
--   * Settings: site images, low-stock badge threshold, "IMNY-" order prefix
--   * Admin-managed lookbook images
--   * Newsletter sign-ups and contact messages (written only by the server)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
alter table public.store_settings drop constraint if exists store_settings_order_prefix_check;
alter table public.store_settings add constraint store_settings_order_prefix_check
  check (order_prefix ~ '^[A-Z0-9]{1,6}-?$');

alter table public.store_settings
  add column low_stock_badge_threshold integer not null default 10 check (low_stock_badge_threshold >= 0),
  add column hero_image_path text check (hero_image_path ~ '^site/' and char_length(hero_image_path) <= 512),
  add column about_image_path text check (about_image_path ~ '^site/' and char_length(about_image_path) <= 512);

comment on column public.store_settings.announcement is
  'Scrolling banner messages, separated by "|".';

-- ---------------------------------------------------------------------------
-- Pay on delivery
-- ---------------------------------------------------------------------------
alter table public.delivery_zones add column allow_cod boolean not null default false;

alter table public.orders
  add column payment_method text not null default 'online' check (payment_method in ('online', 'cod'));

create index orders_cod_unpaid_idx on public.orders (created_at desc)
  where payment_method = 'cod' and payment_status = 'pending';

-- place_cod_order: same validation, pricing and stock locking as place_order,
-- then the stock is committed straight away (no payment hold to expire) and
-- the order is confirmed with payment still pending until cash is collected.
create or replace function public.place_cod_order(
  p_items jsonb,
  p_customer jsonb,
  p_shipping jsonb,
  p_delivery_zone_id uuid,
  p_discount_code text,
  p_payment_reference text,
  p_access_token_hash text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_order_id uuid;
begin
  if not exists (
    select 1 from public.delivery_zones where id = p_delivery_zone_id and is_active and allow_cod
  ) then
    raise exception 'COD_NOT_AVAILABLE';
  end if;

  v_result := public.place_order(
    p_items, p_customer, p_shipping, p_delivery_zone_id, p_discount_code,
    null, 'cod', p_payment_reference, p_access_token_hash
  );
  if not (v_result ->> 'ok')::boolean then
    return v_result;
  end if;

  v_order_id := (v_result ->> 'order_id')::uuid;
  perform public._commit_order_stock(v_order_id);

  update public.orders
  set payment_method = 'cod', status = 'confirmed', reservation_expires_at = null
  where id = v_order_id;

  return v_result || jsonb_build_object('payment_method', 'cod');
end;
$$;

-- Staff: record that the cash for a pay-on-delivery order was collected.
create or replace function public.admin_record_cod_payment(p_order_id uuid, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform public.require_staff();

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_order.payment_method <> 'cod' or v_order.payment_status <> 'pending' or v_order.status = 'cancelled' then
    raise exception 'INVALID_ARGUMENT' using detail = 'Only open pay-on-delivery orders awaiting cash can be marked paid.';
  end if;

  update public.orders set payment_status = 'paid', paid_at = now() where id = p_order_id;

  insert into public.order_notes (order_id, author_id, body)
  values (p_order_id, auth.uid(), left(coalesce(nullif(trim(p_note), ''), 'Cash received on delivery'), 2000));
end;
$$;

-- Staff status updates: pay-on-delivery orders may be fulfilled before payment.
create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_note text default null,
  p_restock boolean default true
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_rank_old integer;
  v_rank_new integer;
begin
  perform public.require_staff();

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_order.status = p_status then
    return;
  end if;
  if v_order.status in ('delivered', 'cancelled') then
    raise exception 'ORDER_CLOSED';
  end if;

  if p_status = 'cancelled' then
    if v_order.stock_state = 'reserved' then
      perform public._release_reserved_stock(array[v_order.id]);
    elsif v_order.stock_state = 'committed' and p_restock then
      perform 1 from public.inventory
      where variant_id in (select variant_id from public.order_items where order_id = v_order.id)
      order by variant_id for update;

      update public.inventory i
      set on_hand = i.on_hand + q.qty, updated_at = now()
      from (
        select variant_id, sum(quantity)::integer as qty
        from public.order_items where order_id = v_order.id and variant_id is not null group by variant_id
      ) q
      where i.variant_id = q.variant_id;

      insert into public.inventory_movements (variant_id, delta_on_hand, reason, order_id, actor_id)
      select variant_id, quantity, 'order_cancelled_restock', order_id, auth.uid()
      from public.order_items where order_id = v_order.id and variant_id is not null;

      update public.orders set stock_state = 'released' where id = v_order.id;
    end if;

    update public.orders
    set status = 'cancelled',
        cancelled_at = now(),
        cancel_reason = left(coalesce(nullif(trim(p_note), ''), 'Cancelled by store'), 300),
        payment_status = case when payment_status = 'pending' then 'failed'::public.payment_status else payment_status end,
        requires_attention = case when payment_status = 'paid' then true else requires_attention end,
        attention_reason = case when payment_status = 'paid' then 'Cancelled after payment: refund required.' else attention_reason end
    where id = v_order.id;
  else
    if not (
      v_order.payment_status = 'paid'
      or (v_order.payment_method = 'cod' and v_order.payment_status = 'pending')
    ) then
      raise exception 'ORDER_NOT_PAID';
    end if;

    v_rank_old := array_position(
      array['pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered']::public.order_status[], v_order.status);
    v_rank_new := array_position(
      array['pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered']::public.order_status[], p_status);

    if v_rank_new is null or v_rank_new <= v_rank_old then
      raise exception 'INVALID_STATUS_TRANSITION';
    end if;

    update public.orders set status = p_status where id = v_order.id;
  end if;

  if nullif(trim(p_note), '') is not null then
    insert into public.order_notes (order_id, author_id, body)
    values (v_order.id, auth.uid(), left(trim(p_note), 2000));
  end if;
end;
$$;

-- Dashboard: count pay-on-delivery orders among those to fulfil.
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_threshold integer;
begin
  perform public.require_staff();
  select low_stock_threshold into v_threshold from public.store_settings where id;

  return jsonb_build_object(
    'currency', (select currency from public.store_settings where id),
    'total_orders', (select count(*) from public.orders
                     where payment_status in ('paid', 'refunded') or (payment_method = 'cod' and status <> 'cancelled')),
    'revenue_minor', (select coalesce(sum(total_minor), 0) from public.orders where payment_status = 'paid'),
    'revenue_30d_minor', (select coalesce(sum(total_minor), 0) from public.orders
                          where payment_status = 'paid' and paid_at >= now() - interval '30 days'),
    'orders_30d', (select count(*) from public.orders
                   where created_at >= now() - interval '30 days'
                     and (payment_status = 'paid' or (payment_method = 'cod' and status <> 'cancelled'))),
    'pending_orders', (select count(*) from public.orders
                       where status in ('confirmed', 'processing', 'ready')
                         and (payment_status = 'paid' or (payment_method = 'cod' and payment_status = 'pending'))),
    'cod_awaiting_cash', (select count(*) from public.orders
                          where payment_method = 'cod' and payment_status = 'pending' and status <> 'cancelled'),
    'attention_orders', (select count(*) from public.orders where requires_attention),
    'active_products', (select count(*) from public.products where status = 'active'),
    'draft_products', (select count(*) from public.products where status = 'draft'),
    'low_stock_variants', (
      select count(*) from public.inventory i
      join public.product_variants v on v.id = i.variant_id
      join public.products p on p.id = v.product_id
      where v.is_active and p.status = 'active'
        and i.on_hand - i.reserved <= coalesce(i.low_stock_threshold, v_threshold)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Lookbook images (files in the catalog bucket under site/lookbook/)
-- ---------------------------------------------------------------------------
create table public.lookbook_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique check (storage_path ~ '^site/lookbook/' and char_length(storage_path) <= 512),
  label text check (char_length(label) <= 80),
  alt_text text check (char_length(alt_text) <= 300),
  position integer not null default 0,
  width integer check (width > 0),
  height integer check (height > 0),
  created_at timestamptz not null default now()
);

alter table public.lookbook_images enable row level security;
grant select on public.lookbook_images to anon, authenticated;
grant insert, update, delete on public.lookbook_images to authenticated;

create policy lookbook_read on public.lookbook_images for select to anon, authenticated using (true);
create policy lookbook_staff_insert on public.lookbook_images for insert to authenticated with check ((select public.is_staff()));
create policy lookbook_staff_update on public.lookbook_images for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy lookbook_staff_delete on public.lookbook_images for delete to authenticated using ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- Newsletter and contact messages: inserted by the server (service role,
-- rate-limited); staff can read and manage them. No public access.
-- ---------------------------------------------------------------------------
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and char_length(email) <= 254),
  source text check (char_length(source) <= 40),
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text check (char_length(name) <= 120),
  email text not null check (email = lower(email) and char_length(email) <= 254),
  message text not null check (char_length(message) between 1 and 4000),
  handled boolean not null default false,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index contact_messages_open_idx on public.contact_messages (created_at desc) where not handled;

alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages enable row level security;

grant select, delete on public.newsletter_subscribers to authenticated;
grant select on public.contact_messages to authenticated;
grant update (handled, handled_at) on public.contact_messages to authenticated;

create policy newsletter_staff_read on public.newsletter_subscribers for select to authenticated using ((select public.is_staff()));
create policy newsletter_admin_delete on public.newsletter_subscribers for delete to authenticated using ((select public.is_admin()));
create policy contact_staff_read on public.contact_messages for select to authenticated using ((select public.is_staff()));
create policy contact_staff_update on public.contact_messages for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke execute on function public.place_cod_order(jsonb, jsonb, jsonb, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_record_cod_payment(uuid, text) to authenticated;
grant execute on function public.admin_update_order_status(uuid, public.order_status, text, boolean) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
grant all on public.lookbook_images, public.newsletter_subscribers, public.contact_messages to service_role;
grant execute on all functions in schema public to service_role;
