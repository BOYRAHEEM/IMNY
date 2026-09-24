-- =============================================================================
-- Delivery zone is decided by the customer's region, not picked by them.
-- Each zone lists the regions it covers; the server resolves the zone from the
-- address, and the database refuses orders whose zone doesn't cover the region.
-- =============================================================================

alter table public.delivery_zones
  add column regions text[] not null default '{}'
  check (array_length(regions, 1) is null or array_length(regions, 1) <= 32);

create index delivery_zones_regions_idx on public.delivery_zones using gin (regions);

-- The active zone covering a region (lowest sort order wins if two overlap).
create or replace function public.delivery_zone_for_region(p_region text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.delivery_zones
  where is_active and trim(p_region) = any (regions)
  order by sort_order, name
  limit 1;
$$;

-- Defence in depth: an order's zone must cover its delivery region.
create or replace function public.orders_check_zone_region()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.delivery_zone_id is not null and not exists (
    select 1 from public.delivery_zones z
    where z.id = new.delivery_zone_id and new.shipping_region = any (z.regions)
  ) then
    raise exception 'ZONE_REGION_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger orders_check_zone_region before insert on public.orders
  for each row execute function public.orders_check_zone_region();

grant execute on function public.delivery_zone_for_region(text) to anon, authenticated, service_role;
