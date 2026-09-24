-- Testing consumed some order numbers. Before launch, restart numbering at
-- 1001 so the first real order is IMNY-1001. Does nothing once real orders exist.
do $$
begin
  if not exists (select 1 from public.orders) then
    perform setval('public.order_number_seq', 1001, false);
  end if;
end;
$$;
