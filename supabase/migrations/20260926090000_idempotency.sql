-- Idempotency: a repeated checkout request (double tap, lost response, retry)
-- returns the order it already created instead of making a second one, and
-- each customer email is sent at most once per order.

alter table public.orders
  add column idempotency_key text check (idempotency_key ~ '^[A-Za-z0-9_-]{16,100}$'),
  add column payment_authorization_url text check (char_length(payment_authorization_url) <= 2048);

create unique index orders_idempotency_key_key on public.orders (idempotency_key) where idempotency_key is not null;

-- The original body becomes internal; the public entry point wraps it.
alter function public.place_order(jsonb, jsonb, jsonb, uuid, text, uuid, text, text, text) rename to _place_order;

create function public.place_order(
  p_items jsonb,
  p_customer jsonb,
  p_shipping jsonb,
  p_delivery_zone_id uuid,
  p_discount_code text,
  p_user_id uuid,
  p_payment_provider text,
  p_payment_reference text,
  p_access_token_hash text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_existing public.orders;
  v_result jsonb;
begin
  if p_idempotency_key is not null then
    if p_idempotency_key !~ '^[A-Za-z0-9_-]{16,100}$' then
      raise exception 'INVALID_ARGUMENT';
    end if;
    -- Serialise requests carrying the same key: a concurrent duplicate waits
    -- here, then finds the order the first one created.
    perform pg_advisory_xact_lock(hashtextextended('place_order:' || p_idempotency_key, 0));

    select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
    if found then
      if v_existing.email is distinct from lower(trim(coalesce(p_customer ->> 'email', ''))) then
        raise exception 'IDEMPOTENCY_KEY_REUSED';
      end if;
      return jsonb_build_object(
        'ok', true,
        'replayed', true,
        'order_id', v_existing.id,
        'order_number', v_existing.order_number,
        'email', v_existing.email,
        'currency', v_existing.currency,
        'total_minor', v_existing.total_minor,
        'payment_reference', v_existing.payment_reference,
        'payment_method', v_existing.payment_method,
        'payment_status', v_existing.payment_status,
        'status', v_existing.status,
        'payment_authorization_url', v_existing.payment_authorization_url
      );
    end if;
  end if;

  v_result := public._place_order(
    p_items, p_customer, p_shipping, p_delivery_zone_id, p_discount_code,
    p_user_id, p_payment_provider, p_payment_reference, p_access_token_hash
  );

  if (v_result ->> 'ok')::boolean and p_idempotency_key is not null then
    update public.orders set idempotency_key = p_idempotency_key where id = (v_result ->> 'order_id')::uuid;
  end if;

  return v_result || jsonb_build_object('replayed', false);
end;
$$;

drop function public.place_cod_order(jsonb, jsonb, jsonb, uuid, text, text, text);

create function public.place_cod_order(
  p_items jsonb,
  p_customer jsonb,
  p_shipping jsonb,
  p_delivery_zone_id uuid,
  p_discount_code text,
  p_payment_reference text,
  p_access_token_hash text,
  p_idempotency_key text default null
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
    null, 'cod', p_payment_reference, p_access_token_hash, p_idempotency_key
  );
  -- A replay already had its stock committed the first time.
  if not (v_result ->> 'ok')::boolean or (v_result ->> 'replayed')::boolean then
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

-- One row per email actually sent (or being sent) for an order. The server
-- claims a row before sending; a duplicate claim means "already sent".
create table public.order_emails (
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null check (kind in ('confirmed', 'shipped')),
  sent_at timestamptz not null default now(),
  primary key (order_id, kind)
);

alter table public.order_emails enable row level security;

revoke execute on function public._place_order(jsonb, jsonb, jsonb, uuid, text, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.place_order(jsonb, jsonb, jsonb, uuid, text, uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.place_cod_order(jsonb, jsonb, jsonb, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb, jsonb, uuid, text, uuid, text, text, text, text) to service_role;
grant execute on function public.place_cod_order(jsonb, jsonb, jsonb, uuid, text, text, text, text) to service_role;
grant all on public.order_emails to service_role;
