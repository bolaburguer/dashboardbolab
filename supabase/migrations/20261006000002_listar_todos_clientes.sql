-- Permite que o dashboard carregue todos os clientes quando não houver filtro de WhatsApp.
create or replace function public.buscar_clientes_por_telefone(
  p_termo text,
  p_limite integer default null
)
returns table (
  cliente text,
  telefone text,
  telefone_normalizado text,
  ultimo_pedido_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with pedidos_normalizados as (
    select p.cliente, p.telefone,
      regexp_replace(coalesce(p.telefone, ''), '\\D', '', 'g') as telefone_normalizado,
      p.created_at
    from public.pedidos p
    where p.telefone is not null
  ), clientes_unicos as (
    select distinct on (telefone_normalizado)
      cliente, telefone, telefone_normalizado, created_at as ultimo_pedido_em
    from pedidos_normalizados
    where telefone_normalizado like '%' || regexp_replace(coalesce(p_termo, ''), '\\D', '', 'g') || '%'
      and telefone_normalizado <> ''
    order by telefone_normalizado, created_at desc
  )
  select cliente, telefone, telefone_normalizado, ultimo_pedido_em
  from clientes_unicos
  order by cliente asc, ultimo_pedido_em desc
  limit case
    when p_limite is null then null
    else least(greatest(p_limite, 1), 1000)
  end;
$$;
