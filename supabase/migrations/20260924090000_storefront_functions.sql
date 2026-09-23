-- =============================================================================
-- Storefront listing: one round trip per product grid.
-- SECURITY DEFINER because it summarises stock, but it only ever returns
-- published products, active variants and a sold-out/available total -
-- nothing a shopper couldn't already see.
-- =============================================================================

create or replace function public.storefront_products(
  p_category_id uuid default null,   -- includes direct subcategories
  p_sort text default 'newest',      -- newest | price_asc | price_desc
  p_featured boolean default null,
  p_search text default null,
  p_exclude uuid default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  name text,
  category_id uuid,
  price_min bigint,
  price_max bigint,
  compare_at_min bigint,
  image_path text,
  image_alt text,
  image_width integer,
  image_height integer,
  hover_image_path text,
  available bigint,
  swatches jsonb,
  published_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  return query
  with base as (
    select p.*
    from public.products p
    where p.status = 'active'
      and (p_featured is null or p.featured = p_featured)
      and (p_exclude is null or p.id <> p_exclude)
      and (
        p_category_id is null
        or p.category_id = p_category_id
        or p.category_id in (select c.id from public.categories c where c.parent_id = p_category_id and c.is_active)
      )
      and (v_search is null or p.search @@ plainto_tsquery('simple', v_search) or p.name ilike '%' || v_search || '%')
      and exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active)
  ),
  priced as (
    select
      b.id, b.slug, b.name, b.category_id, b.published_at,
      min(v.price_minor) as price_min,
      max(v.price_minor) as price_max,
      min(v.compare_at_price_minor) filter (where v.compare_at_price_minor is not null) as compare_at_min,
      sum(greatest(coalesce(i.on_hand - i.reserved, 0), 0)) as available
    from base b
    join public.product_variants v on v.product_id = b.id and v.is_active
    left join public.inventory i on i.variant_id = v.id
    group by b.id, b.slug, b.name, b.category_id, b.published_at
  )
  select
    pr.id, pr.slug, pr.name, pr.category_id,
    pr.price_min, pr.price_max, pr.compare_at_min,
    img.storage_path, img.alt_text, img.width, img.height,
    hov.storage_path,
    pr.available,
    coalesce((
      select jsonb_agg(jsonb_build_object('value', ov.value, 'hex', ov.swatch_hex) order by ov.position)
      from public.product_options o
      join public.product_option_values ov on ov.option_id = o.id
      where o.product_id = pr.id and o.name ~* 'colou?r' and ov.swatch_hex is not null
    ), '[]'::jsonb),
    pr.published_at,
    count(*) over ()
  from priced pr
  left join lateral (
    select pi.storage_path, pi.alt_text, pi.width, pi.height
    from public.product_images pi where pi.product_id = pr.id
    order by pi.is_primary desc, pi.position limit 1
  ) img on true
  left join lateral (
    select pi.storage_path
    from public.product_images pi where pi.product_id = pr.id and not pi.is_primary
    order by pi.position limit 1
  ) hov on true
  order by
    case when p_sort = 'price_asc' then pr.price_min end asc nulls last,
    case when p_sort = 'price_desc' then pr.price_min end desc nulls last,
    pr.published_at desc nulls last,
    pr.name
  limit least(greatest(p_limit, 1), 60)
  offset greatest(p_offset, 0);
end;
$$;

revoke execute on function public.storefront_products(uuid, text, boolean, text, uuid, integer, integer) from public;
grant execute on function public.storefront_products(uuid, text, boolean, text, uuid, integer, integer) to anon, authenticated, service_role;
