-- =============================================================================
-- Commerce functions: pricing, checkout, payment confirmation, stock and
-- administrative operations.
--
-- All money, stock and discount decisions are made here, inside the database,
-- from database values. Values sent by a browser are never trusted.
--
-- Error convention: functions raise exceptions whose MESSAGE is a stable code
-- (e.g. 'FORBIDDEN', 'INSUFFICIENT_STOCK'). The app maps codes to friendly
-- text and never shows raw database errors to shoppers.
--
-- Deadlock avoidance: every function that locks several inventory rows locks
-- them in variant_id order.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------
create or replace function public.require_staff()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting: fixed window counter. Returns true if the call is allowed.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if p_key is null or p_max < 1 or p_window_seconds < 1 then
    raise exception 'INVALID_ARGUMENT';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as rl (key, window_start, hits)
  values (left(p_key, 200), v_window, 1)
  on conflict (key, window_start) do update set hits = rl.hits + 1
  returning hits into v_hits;

  return v_hits <= p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public stock availability for active variants of active products.
-- Shoppers never read the inventory table directly.
-- ---------------------------------------------------------------------------
create or replace function public.variant_availability(p_product_ids uuid[])
returns table (variant_id uuid, product_id uuid, available integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.product_id, greatest(coalesce(i.on_hand - i.reserved, 0), 0)
  from public.product_variants v
  join public.products p on p.id = v.product_id
  left join public.inventory i on i.variant_id = v.id
  where v.product_id = any (p_product_ids[1:200])
    and v.is_active
    and p.status = 'active';
$$;

-- ---------------------------------------------------------------------------
-- price_cart: the single source of truth for cart pricing.
--
-- p_items: [{"variant_id": uuid, "quantity": int}, ...]
-- Returns a quote with per-line status, subtotal, delivery, discount, total
-- and "ok" = true when the cart can be purchased as-is. Never writes.
-- ---------------------------------------------------------------------------
create or replace function public.price_cart(
  p_items jsonb,
  p_delivery_zone_id uuid default null,
  p_discount_code text default null,
  p_email text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings public.store_settings;
  v_lines jsonb := '[]'::jsonb;
  v_ok boolean := true;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_delivery bigint := 0;
  v_zone public.delivery_zones;
  v_zone_json jsonb;
  v_code text := nullif(upper(trim(coalesce(p_discount_code, ''))), '');
  v_discount_row public.discount_codes;
  v_discount_error text;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_status text;
  r record;
begin
  select * into v_settings from public.store_settings where id;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'CART_EMPTY';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'CART_TOO_LARGE';
  end if;

  for r in
    with requested as (
      select (e ->> 'variant_id')::uuid as variant_id, sum((e ->> 'quantity')::integer)::integer as quantity
      from jsonb_array_elements(p_items) as e
      group by 1
    )
    select
      req.variant_id,
      req.quantity,
      v.id is not null as variant_exists,
      v.is_active as variant_active,
      v.price_minor,
      v.sku,
      p.id as product_id,
      p.name as product_name,
      p.slug as product_slug,
      p.status as product_status,
      greatest(coalesce(i.on_hand - i.reserved, 0), 0) as available,
      (
        select string_agg(ov.value, ' / ' order by o.position)
        from public.product_option_values ov
        join public.product_options o on o.id = ov.option_id
        where ov.id in (v.option1_value_id, v.option2_value_id, v.option3_value_id)
      ) as variant_title,
      coalesce((
        select jsonb_agg(jsonb_build_object('name', o.name, 'value', ov.value) order by o.position)
        from public.product_option_values ov
        join public.product_options o on o.id = ov.option_id
        where ov.id in (v.option1_value_id, v.option2_value_id, v.option3_value_id)
      ), '[]'::jsonb) as options,
      (
        select pi.storage_path
        from public.product_images pi
        where pi.product_id = p.id
        order by
          (pi.option_value_id is not null
            and pi.option_value_id in (v.option1_value_id, v.option2_value_id, v.option3_value_id)) desc,
          pi.is_primary desc,
          pi.position
        limit 1
      ) as image_path
    from requested req
    left join public.product_variants v on v.id = req.variant_id
    left join public.products p on p.id = v.product_id
    left join public.inventory i on i.variant_id = v.id
    order by req.variant_id
  loop
    if r.quantity is null or r.quantity < 1 then
      raise exception 'INVALID_QUANTITY';
    end if;

    v_status := case
      when not r.variant_exists or not r.variant_active or r.product_status <> 'active' then 'unavailable'
      when r.quantity > v_settings.max_quantity_per_item then 'quantity_limit'
      when r.available < r.quantity then 'insufficient_stock'
      else 'ok'
    end;

    if v_status <> 'ok' then
      v_ok := false;
    else
      v_subtotal := v_subtotal + r.price_minor * r.quantity;
    end if;

    v_lines := v_lines || jsonb_build_object(
      'variant_id', r.variant_id,
      'product_id', r.product_id,
      'product_name', r.product_name,
      'product_slug', r.product_slug,
      'variant_title', r.variant_title,
      'options', r.options,
      'sku', r.sku,
      'image_path', r.image_path,
      'unit_price_minor', r.price_minor,
      'quantity', r.quantity,
      'line_total_minor', case when v_status = 'ok' then r.price_minor * r.quantity else 0 end,
      'available', case when v_status = 'unavailable' then 0 else least(r.available, v_settings.max_quantity_per_item) end,
      'status', v_status
    );
  end loop;

  -- Discount (applies to the merchandise subtotal only)
  if v_code is not null then
    select * into v_discount_row from public.discount_codes where code = v_code;

    if not found or not v_discount_row.is_active
       or (v_discount_row.starts_at is not null and v_discount_row.starts_at > now()) then
      v_discount_error := 'DISCOUNT_INVALID';
    elsif v_discount_row.expires_at is not null and v_discount_row.expires_at <= now() then
      v_discount_error := 'DISCOUNT_EXPIRED';
    elsif v_discount_row.usage_limit is not null and v_discount_row.usage_count >= v_discount_row.usage_limit then
      v_discount_error := 'DISCOUNT_USAGE_LIMIT';
    elsif v_subtotal < v_discount_row.min_order_minor then
      v_discount_error := 'DISCOUNT_MIN_ORDER';
    elsif v_discount_row.per_customer_limit is not null and v_email is not null
          and (select count(*) from public.discount_redemptions dr
               where dr.discount_id = v_discount_row.id and dr.email = v_email) >= v_discount_row.per_customer_limit then
      v_discount_error := 'DISCOUNT_CUSTOMER_LIMIT';
    else
      if v_discount_row.type = 'percentage' then
        v_discount := floor(v_subtotal * v_discount_row.value / 100.0)::bigint;
      else
        v_discount := v_discount_row.value;
      end if;
      if v_discount_row.max_discount_minor is not null then
        v_discount := least(v_discount, v_discount_row.max_discount_minor);
      end if;
      v_discount := least(v_discount, v_subtotal);
    end if;

    if v_discount_error is not null then
      v_ok := false;
    end if;
  end if;

  -- Delivery (free-delivery thresholds use the discounted subtotal)
  if p_delivery_zone_id is not null then
    select * into v_zone from public.delivery_zones where id = p_delivery_zone_id and is_active;
    if not found then
      v_ok := false;
      v_zone_json := jsonb_build_object('id', p_delivery_zone_id, 'error', 'INVALID_DELIVERY_ZONE');
    else
      v_delivery := case
        when v_zone.free_over_minor is not null and v_subtotal - v_discount >= v_zone.free_over_minor then 0
        when v_settings.free_delivery_over_minor is not null
             and v_subtotal - v_discount >= v_settings.free_delivery_over_minor then 0
        else v_zone.fee_minor
      end;
      v_zone_json := jsonb_build_object('id', v_zone.id, 'name', v_zone.name, 'estimated_days', v_zone.estimated_days);
    end if;
  end if;

  return jsonb_build_object(
    'ok', v_ok,
    'currency', v_settings.currency,
    'lines', v_lines,
    'subtotal_minor', v_subtotal,
    'discount_minor', v_discount,
    'discount', case when v_code is null then null else jsonb_build_object(
      'code', v_code,
      'id', v_discount_row.id,
      'error', v_discount_error,
      'min_order_minor', case when v_discount_error = 'DISCOUNT_MIN_ORDER' then v_discount_row.min_order_minor end
    ) end,
    'delivery_fee_minor', v_delivery,
    'delivery_zone', v_zone_json,
    'total_minor', v_subtotal - v_discount + v_delivery,
    'free_delivery_over_minor', coalesce(v_zone.free_over_minor, v_settings.free_delivery_over_minor)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Internal: return reserved stock for a set of orders (caller holds the
-- order row locks). Also returns any discount usage those orders consumed.
-- ---------------------------------------------------------------------------
create or replace function public._release_reserved_stock(p_order_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  select array_agg(id) into v_ids
  from public.orders
  where id = any (p_order_ids) and stock_state = 'reserved';

  if v_ids is null then
    return;
  end if;

  perform 1 from public.inventory
  where variant_id in (select variant_id from public.order_items where order_id = any (v_ids))
  order by variant_id
  for update;

  update public.inventory i
  set reserved = greatest(i.reserved - q.qty, 0), updated_at = now()
  from (
    select variant_id, sum(quantity)::integer as qty
    from public.order_items
    where order_id = any (v_ids) and variant_id is not null
    group by variant_id
  ) q
  where i.variant_id = q.variant_id;

  insert into public.inventory_movements (variant_id, delta_reserved, reason, order_id, actor_id)
  select oi.variant_id, -oi.quantity, 'reservation_released', oi.order_id, auth.uid()
  from public.order_items oi
  where oi.order_id = any (v_ids) and oi.variant_id is not null;

  with removed as (
    delete from public.discount_redemptions where order_id = any (v_ids) returning discount_id
  )
  update public.discount_codes c
  set usage_count = greatest(c.usage_count - x.n, 0)
  from (select discount_id, count(*)::integer as n from removed group by discount_id) x
  where c.id = x.discount_id;

  update public.orders set stock_state = 'released', reservation_expires_at = null where id = any (v_ids);
end;
$$;

-- ---------------------------------------------------------------------------
-- Internal: permanently deduct stock for a paid order (caller holds the order
-- row lock). If the reservation had already expired, try to re-acquire stock.
-- Returns true when stock is committed.
-- ---------------------------------------------------------------------------
create or replace function public._commit_order_stock(p_order_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_short integer;
begin
  select * into v_order from public.orders where id = p_order_id;

  if v_order.stock_state = 'committed' then
    return true;
  end if;

  perform 1 from public.inventory
  where variant_id in (select variant_id from public.order_items where order_id = p_order_id)
  order by variant_id
  for update;

  if v_order.stock_state = 'released' then
    -- Late payment after the reservation lapsed: is the stock still there?
    select count(*) into v_short
    from (
      select variant_id, sum(quantity) as qty
      from public.order_items where order_id = p_order_id group by variant_id
    ) q
    left join public.inventory i on i.variant_id = q.variant_id
    where q.variant_id is null or i.variant_id is null or i.on_hand - i.reserved < q.qty;

    if v_short > 0 then
      return false;
    end if;

    update public.inventory i
    set on_hand = i.on_hand - q.qty, updated_at = now()
    from (
      select variant_id, sum(quantity)::integer as qty
      from public.order_items where order_id = p_order_id group by variant_id
    ) q
    where i.variant_id = q.variant_id;

    insert into public.inventory_movements (variant_id, delta_on_hand, reason, order_id)
    select variant_id, -quantity, 'order_committed', order_id
    from public.order_items where order_id = p_order_id;

    -- Re-record the discount the customer actually paid with.
    if v_order.discount_code_id is not null and v_order.discount_minor > 0 then
      insert into public.discount_redemptions (discount_id, order_id, customer_id, email, amount_minor)
      values (v_order.discount_code_id, v_order.id, v_order.customer_id, v_order.email, v_order.discount_minor)
      on conflict (order_id) do nothing;
      update public.discount_codes set usage_count = usage_count + 1 where id = v_order.discount_code_id;
    end if;
  else
    update public.inventory i
    set on_hand = i.on_hand - q.qty, reserved = greatest(i.reserved - q.qty, 0), updated_at = now()
    from (
      select variant_id, sum(quantity)::integer as qty
      from public.order_items where order_id = p_order_id and variant_id is not null group by variant_id
    ) q
    where i.variant_id = q.variant_id;

    insert into public.inventory_movements (variant_id, delta_on_hand, delta_reserved, reason, order_id)
    select variant_id, -quantity, -quantity, 'order_committed', order_id
    from public.order_items where order_id = p_order_id and variant_id is not null;
  end if;

  update public.orders set stock_state = 'committed', reservation_expires_at = null where id = p_order_id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- release_expired_reservations: cancels unpaid orders whose hold has lapsed
-- and returns their stock. Run by pg_cron every minute and by the app before
-- checkout (in its own transaction).
-- ---------------------------------------------------------------------------
create or replace function public.release_expired_reservations()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  -- Only one releaser at a time; others simply skip.
  if not pg_try_advisory_xact_lock(hashtext('public.release_expired_reservations')) then
    return 0;
  end if;

  select array_agg(id) into v_ids
  from (
    select id from public.orders
    where stock_state = 'reserved'
      and payment_status in ('pending', 'failed')
      and reservation_expires_at < now()
    order by reservation_expires_at
    limit 500
    for update skip locked
  ) s;

  if v_ids is null then
    return 0;
  end if;

  perform public._release_reserved_stock(v_ids);

  update public.orders
  set status = 'cancelled',
      payment_status = case when payment_status = 'pending' then 'failed'::public.payment_status else payment_status end,
      cancelled_at = now(),
      cancel_reason = 'Payment not completed in time'
  where id = any (v_ids);

  return array_length(v_ids, 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- place_order: validates and prices the cart from the database, reserves
-- stock atomically and creates the order. Called only by the server (service
-- role) after it has authenticated the user (if any) and rate-limited.
--
-- p_customer:  {"email", "phone", "name"}
-- p_shipping:  {"line1", "line2", "city", "region", "digital_address", "instructions"}
-- Returns {"ok": true, order...} or {"ok": false, "error": code, "quote": ...}
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_items jsonb,
  p_customer jsonb,
  p_shipping jsonb,
  p_delivery_zone_id uuid,
  p_discount_code text,
  p_user_id uuid,
  p_payment_provider text,
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
  v_settings public.store_settings;
  v_email text := lower(trim(coalesce(p_customer ->> 'email', '')));
  v_phone text := trim(coalesce(p_customer ->> 'phone', ''));
  v_name text := trim(coalesce(p_customer ->> 'name', ''));
  v_user_email text;
  v_user_confirmed boolean := false;
  v_link_user uuid;
  v_quote jsonb;
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_code text := nullif(upper(trim(coalesce(p_discount_code, ''))), '');
begin
  -- Input validation (the app validates too; this is defence in depth)
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'INVALID_EMAIL';
  end if;
  if char_length(v_phone) < 7 or char_length(v_phone) > 32 then
    raise exception 'INVALID_PHONE';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'INVALID_NAME';
  end if;
  if nullif(trim(p_shipping ->> 'line1'), '') is null
     or nullif(trim(p_shipping ->> 'city'), '') is null
     or nullif(trim(p_shipping ->> 'region'), '') is null then
    raise exception 'INVALID_ADDRESS';
  end if;
  if p_delivery_zone_id is null then
    raise exception 'DELIVERY_ZONE_REQUIRED';
  end if;
  if p_access_token_hash is null or p_access_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_ARGUMENT';
  end if;

  select * into v_settings from public.store_settings where id;

  if p_user_id is null then
    if not v_settings.allow_guest_checkout then
      raise exception 'GUEST_CHECKOUT_DISABLED';
    end if;
  else
    select lower(email), email_confirmed_at is not null
      into v_user_email, v_user_confirmed
    from auth.users where id = p_user_id;
    if not found then
      raise exception 'INVALID_USER';
    end if;
  end if;

  -- Lock the stock rows we are about to reserve (deterministic order).
  perform 1 from public.inventory
  where variant_id in (
    select (e ->> 'variant_id')::uuid from jsonb_array_elements(p_items) e
  )
  order by variant_id
  for update;

  -- Lock the discount so its usage limit cannot be exceeded concurrently.
  if v_code is not null then
    perform 1 from public.discount_codes where code = v_code for update;
  end if;

  -- Price everything from the database, with the locks held.
  v_quote := public.price_cart(p_items, p_delivery_zone_id, v_code, v_email);

  if not (v_quote ->> 'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', 'CART_INVALID', 'quote', v_quote);
  end if;

  -- Find or create the customer record. Link it to the account only when the
  -- account's verified email matches the order email.
  if p_user_id is not null and v_user_confirmed and v_user_email = v_email
     and not exists (select 1 from public.customers where user_id = p_user_id) then
    v_link_user := p_user_id;
  end if;

  insert into public.customers as c (email, full_name, phone, user_id)
  values (v_email, v_name, v_phone, v_link_user)
  on conflict (email) do update
    set user_id = coalesce(c.user_id, excluded.user_id),
        full_name = coalesce(c.full_name, excluded.full_name),
        phone = coalesce(c.phone, excluded.phone)
  returning id into v_customer_id;

  v_order_number := v_settings.order_prefix || nextval('public.order_number_seq')::text;

  insert into public.orders (
    order_number, customer_id, user_id, email, phone,
    shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_region,
    shipping_digital_address, delivery_instructions, delivery_zone_id, delivery_zone_name,
    currency, subtotal_minor, delivery_fee_minor, discount_minor, total_minor,
    discount_code_id, discount_code,
    payment_provider, payment_reference, stock_state, reservation_expires_at, access_token_hash
  ) values (
    v_order_number, v_customer_id, p_user_id, v_email, v_phone,
    v_name,
    left(trim(p_shipping ->> 'line1'), 200),
    left(nullif(trim(p_shipping ->> 'line2'), ''), 200),
    left(trim(p_shipping ->> 'city'), 80),
    left(trim(p_shipping ->> 'region'), 80),
    left(nullif(upper(trim(p_shipping ->> 'digital_address')), ''), 20),
    left(nullif(trim(p_shipping ->> 'instructions'), ''), 500),
    p_delivery_zone_id,
    v_quote -> 'delivery_zone' ->> 'name',
    v_quote ->> 'currency',
    (v_quote ->> 'subtotal_minor')::bigint,
    (v_quote ->> 'delivery_fee_minor')::bigint,
    (v_quote ->> 'discount_minor')::bigint,
    (v_quote ->> 'total_minor')::bigint,
    case when v_code is not null then (v_quote -> 'discount' ->> 'id')::uuid end,
    v_code,
    p_payment_provider,
    p_payment_reference,
    'reserved',
    now() + make_interval(mins => v_settings.reservation_minutes),
    p_access_token_hash
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, variant_id, product_name, product_slug, variant_title, options,
    sku, image_path, unit_price_minor, quantity, line_total_minor
  )
  select
    v_order_id, l.product_id, l.variant_id, l.product_name, l.product_slug, l.variant_title,
    l.options, l.sku, l.image_path, l.unit_price_minor, l.quantity, l.line_total_minor
  from jsonb_to_recordset(v_quote -> 'lines') as l (
    product_id uuid, variant_id uuid, product_name text, product_slug text, variant_title text,
    options jsonb, sku text, image_path text, unit_price_minor bigint, quantity integer,
    line_total_minor bigint
  );

  update public.inventory i
  set reserved = i.reserved + l.quantity, updated_at = now()
  from jsonb_to_recordset(v_quote -> 'lines') as l (variant_id uuid, quantity integer)
  where i.variant_id = l.variant_id;

  insert into public.inventory_movements (variant_id, delta_reserved, reason, order_id, actor_id)
  select l.variant_id, l.quantity, 'order_reserved', v_order_id, p_user_id
  from jsonb_to_recordset(v_quote -> 'lines') as l (variant_id uuid, quantity integer);

  if v_code is not null then
    insert into public.discount_redemptions (discount_id, order_id, customer_id, email, amount_minor)
    values ((v_quote -> 'discount' ->> 'id')::uuid, v_order_id, v_customer_id, v_email,
            (v_quote ->> 'discount_minor')::bigint);
    update public.discount_codes set usage_count = usage_count + 1
    where id = (v_quote -> 'discount' ->> 'id')::uuid;
  end if;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'email', v_email,
    'currency', v_quote ->> 'currency',
    'total_minor', (v_quote ->> 'total_minor')::bigint,
    'payment_reference', p_payment_reference
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_order_paid: called by the server ONLY after it has verified the
-- payment with the provider (signed webhook + server-to-server verify).
-- Idempotent: repeated calls for the same reference are harmless.
-- ---------------------------------------------------------------------------
create or replace function public.mark_order_paid(
  p_reference text,
  p_amount_minor bigint,
  p_currency text,
  p_paid_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_committed boolean;
begin
  select * into v_order from public.orders where payment_reference = p_reference for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;

  if v_order.payment_status in ('paid', 'refunded') then
    return jsonb_build_object('ok', true, 'already_processed', true, 'order_id', v_order.id);
  end if;

  if p_amount_minor is distinct from v_order.total_minor or upper(p_currency) is distinct from v_order.currency then
    update public.orders
    set requires_attention = true,
        attention_reason = format('Payment amount mismatch: received %s %s, expected %s %s.',
                                  p_amount_minor, upper(p_currency), v_order.total_minor, v_order.currency)
    where id = v_order.id;
    return jsonb_build_object('ok', false, 'error', 'AMOUNT_MISMATCH', 'order_id', v_order.id);
  end if;

  v_committed := public._commit_order_stock(v_order.id);

  update public.orders
  set payment_status = 'paid',
      paid_at = coalesce(p_paid_at, now()),
      status = case when v_committed and status in ('pending', 'cancelled') then 'confirmed'::public.order_status else status end,
      cancelled_at = case when v_committed then null else cancelled_at end,
      cancel_reason = case when v_committed then null else cancel_reason end,
      requires_attention = case when v_committed then requires_attention else true end,
      attention_reason = case when v_committed then attention_reason
                              else 'Paid after the stock hold expired and items are no longer available. Refund or restock required.' end
  where id = v_order.id;

  return jsonb_build_object('ok', true, 'order_id', v_order.id, 'stock_committed', v_committed);
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_order_payment_failed: verified failure/abandonment from the provider.
-- ---------------------------------------------------------------------------
create or replace function public.mark_order_payment_failed(p_reference text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where payment_reference = p_reference for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;
  if v_order.payment_status <> 'pending' then
    return jsonb_build_object('ok', true, 'already_processed', true, 'order_id', v_order.id);
  end if;

  perform public._release_reserved_stock(array[v_order.id]);

  update public.orders
  set payment_status = 'failed', status = 'cancelled', cancelled_at = now(), cancel_reason = 'Payment failed'
  where id = v_order.id;

  return jsonb_build_object('ok', true, 'order_id', v_order.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff: update order status
-- Allowed: forward moves along the fulfilment path (skipping is fine), or
-- cancellation of anything not yet delivered. Unpaid orders cannot be
-- fulfilled.
-- ---------------------------------------------------------------------------
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
    if v_order.payment_status <> 'paid' then
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

-- Admin: record that a paid order was refunded (the refund itself is issued
-- in the payment provider's dashboard).
create or replace function public.admin_mark_refunded(p_order_id uuid, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform public.require_admin();

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_order.payment_status <> 'paid' then
    raise exception 'ORDER_NOT_PAID';
  end if;

  update public.orders
  set payment_status = 'refunded', requires_attention = false, attention_reason = null
  where id = p_order_id;

  insert into public.order_notes (order_id, author_id, body)
  values (p_order_id, auth.uid(), left(coalesce(nullif(trim(p_note), ''), 'Marked as refunded'), 2000));
end;
$$;

-- Staff: clear the "needs attention" flag once handled.
create or replace function public.admin_resolve_attention(p_order_id uuid, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.require_staff();
  update public.orders set requires_attention = false where id = p_order_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  insert into public.order_notes (order_id, author_id, body)
  values (p_order_id, auth.uid(), left(coalesce(nullif(trim(p_note), ''), 'Resolved'), 2000));
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff: stock changes (always logged)
-- ---------------------------------------------------------------------------
create or replace function public.adjust_inventory(
  p_variant_id uuid,
  p_delta integer,
  p_reason public.inventory_reason default 'manual_adjustment',
  p_note text default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv public.inventory;
begin
  perform public.require_staff();

  if p_reason not in ('initial', 'restock', 'manual_adjustment', 'return') then
    raise exception 'INVALID_ARGUMENT';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'INVALID_ARGUMENT';
  end if;

  select * into v_inv from public.inventory where variant_id = p_variant_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_inv.on_hand + p_delta < v_inv.reserved then
    raise exception 'STOCK_BELOW_RESERVED'
      using detail = format('%s unit(s) are held for unpaid orders.', v_inv.reserved);
  end if;

  update public.inventory
  set on_hand = on_hand + p_delta, updated_at = now()
  where variant_id = p_variant_id;

  insert into public.inventory_movements (variant_id, delta_on_hand, reason, note, actor_id)
  values (p_variant_id, p_delta, p_reason, left(nullif(trim(p_note), ''), 300), auth.uid());

  return v_inv.on_hand + p_delta;
end;
$$;

create or replace function public.set_inventory_level(
  p_variant_id uuid,
  p_on_hand integer,
  p_note text default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_current integer;
begin
  perform public.require_staff();

  if p_on_hand is null or p_on_hand < 0 then
    raise exception 'INVALID_ARGUMENT';
  end if;

  select on_hand into v_current from public.inventory where variant_id = p_variant_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_current = p_on_hand then
    return v_current;
  end if;

  return public.adjust_inventory(p_variant_id, p_on_hand - v_current, 'manual_adjustment', p_note);
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff: reorder product images and choose the primary one in one call.
-- ---------------------------------------------------------------------------
create or replace function public.reorder_product_images(
  p_product_id uuid,
  p_image_ids uuid[],
  p_primary_id uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_expected integer;
begin
  perform public.require_staff();

  select count(*) into v_expected from public.product_images where product_id = p_product_id;
  if v_expected <> coalesce(array_length(p_image_ids, 1), 0)
     or v_expected <> (select count(distinct x) from unnest(p_image_ids) x
                       where x in (select id from public.product_images where product_id = p_product_id)) then
    raise exception 'INVALID_ARGUMENT' using detail = 'Image list must contain every image of the product exactly once.';
  end if;

  update public.product_images pi
  set position = o.ord - 1
  from unnest(p_image_ids) with ordinality as o (id, ord)
  where pi.id = o.id and pi.product_id = p_product_id;

  if p_primary_id is not null then
    if not (p_primary_id = any (p_image_ids)) then
      raise exception 'INVALID_ARGUMENT';
    end if;
    update public.product_images set is_primary = false where product_id = p_product_id and is_primary;
    update public.product_images set is_primary = true where id = p_primary_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: change a user's role. Cannot change your own role, and the last
-- admin cannot be demoted.
-- ---------------------------------------------------------------------------
create or replace function public.set_user_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_current public.user_role;
begin
  perform public.require_admin();

  if p_user_id = auth.uid() then
    raise exception 'CANNOT_CHANGE_OWN_ROLE';
  end if;

  -- Serialise role changes so two admins cannot demote each other at once.
  perform pg_advisory_xact_lock(hashtext('public.set_user_role'));

  select role into v_current from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_current = 'admin' and p_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'LAST_ADMIN';
  end if;

  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Customer: after signing in with a VERIFIED email, attach earlier guest
-- orders placed with that email to the account.
-- ---------------------------------------------------------------------------
create or replace function public.claim_guest_orders()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed boolean;
  v_customer_id uuid;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  select lower(email), email_confirmed_at is not null into v_email, v_confirmed
  from auth.users where id = v_uid;

  if not v_confirmed or v_email is null then
    return 0;
  end if;

  update public.customers set user_id = v_uid
  where email = v_email and user_id is null
    and not exists (select 1 from public.customers where user_id = v_uid)
  returning id into v_customer_id;

  if v_customer_id is null then
    select id into v_customer_id from public.customers where email = v_email and user_id = v_uid;
  end if;
  if v_customer_id is null then
    return 0;
  end if;

  update public.orders set user_id = v_uid
  where customer_id = v_customer_id and user_id is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff dashboard summary (one round trip, nothing sensitive)
-- ---------------------------------------------------------------------------
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
    'total_orders', (select count(*) from public.orders where payment_status in ('paid', 'refunded')),
    'revenue_minor', (select coalesce(sum(total_minor), 0) from public.orders where payment_status = 'paid'),
    'revenue_30d_minor', (select coalesce(sum(total_minor), 0) from public.orders
                          where payment_status = 'paid' and paid_at >= now() - interval '30 days'),
    'orders_30d', (select count(*) from public.orders
                   where payment_status = 'paid' and paid_at >= now() - interval '30 days'),
    'pending_orders', (select count(*) from public.orders
                       where payment_status = 'paid' and status in ('confirmed', 'processing', 'ready')),
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
-- Execute privileges. Everything else stays private (see default privileges).
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.variant_availability(uuid[]) to anon, authenticated;
grant execute on function public.claim_guest_orders() to authenticated;

-- Staff/admin operations: callable by signed-in users, role checked inside.
grant execute on function public.admin_update_order_status(uuid, public.order_status, text, boolean) to authenticated;
grant execute on function public.admin_mark_refunded(uuid, text) to authenticated;
grant execute on function public.admin_resolve_attention(uuid, text) to authenticated;
grant execute on function public.adjust_inventory(uuid, integer, public.inventory_reason, text) to authenticated;
grant execute on function public.set_inventory_level(uuid, integer, text) to authenticated;
grant execute on function public.reorder_product_images(uuid, uuid[], uuid) to authenticated;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- Server-only (service role): checkout, payment confirmation, rate limits.
grant execute on all functions in schema public to service_role;
