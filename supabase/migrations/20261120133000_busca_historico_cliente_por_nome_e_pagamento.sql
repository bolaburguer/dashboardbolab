-- Permite à equipe localizar clientes pelo nome ou por parte do telefone.
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
  with termo as (
    select
      btrim(coalesce(p_termo, '')) as texto,
      regexp_replace(coalesce(p_termo, ''), '[^0-9]', '', 'g') as digitos,
      translate(
        lower(btrim(coalesce(p_termo, ''))),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'
      ) as texto_normalizado
  ),
  pedidos_normalizados as (
    select
      p.cliente,
      p.telefone,
      regexp_replace(coalesce(p.telefone, ''), '[^0-9]', '', 'g') as telefone_normalizado,
      p.created_at
    from public.pedidos p
    where p.telefone is not null and public.eh_equipe()
  ),
  clientes_unicos as (
    select distinct on (pn.telefone_normalizado)
      pn.cliente,
      pn.telefone,
      pn.telefone_normalizado,
      pn.created_at as ultimo_pedido_em
    from pedidos_normalizados pn
    cross join termo t
    where pn.telefone_normalizado <> ''
      and (
        t.texto = ''
        or (t.digitos <> '' and pn.telefone_normalizado like '%' || t.digitos || '%')
        or position(
          t.texto_normalizado in translate(
            lower(coalesce(pn.cliente, '')),
            'áàâãäéèêëíìîïóòôõöúùûüç',
            'aaaaaeeeeiiiiooooouuuuc'
          )
        ) > 0
      )
    order by pn.telefone_normalizado, pn.created_at desc
  )
  select cu.cliente, cu.telefone, cu.telefone_normalizado, cu.ultimo_pedido_em
  from clientes_unicos cu
  order by cu.cliente asc, cu.ultimo_pedido_em desc
  limit case
    when p_limite is null then null
    else least(greatest(p_limite, 1), 1000)
  end;
$$;

revoke execute on function public.buscar_clientes_por_telefone(text, integer) from public, anon;
grant execute on function public.buscar_clientes_por_telefone(text, integer) to authenticated;

-- Consulta com pagamento visível somente à equipe do dashboard.
-- A função pública usada pelo site de pedidos mantém o retorno original.
create or replace function public.buscar_historico_cliente_dashboard(
  p_telefone text,
  p_limite integer default 50
)
returns table (
  id bigint,
  cliente text,
  telefone text,
  endereco text,
  itens jsonb,
  total numeric,
  status text,
  tipo_entrega text,
  taxa_entrega numeric,
  forma_pagamento text,
  pago boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.cliente,
    p.telefone,
    p.endereco,
    p.itens,
    p.total,
    p.status,
    p.tipo_entrega,
    p.taxa_entrega,
    p.forma_pagamento::text,
    p.pago,
    p.created_at
  from public.pedidos p
  where public.eh_equipe()
    and regexp_replace(coalesce(p.telefone, ''), '[^0-9]', '', 'g')
      = regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g')
  order by p.created_at desc
  limit least(greatest(coalesce(p_limite, 50), 1), 50);
$$;

revoke execute on function public.buscar_historico_cliente_dashboard(text, integer) from public, anon;
grant execute on function public.buscar_historico_cliente_dashboard(text, integer) to authenticated;
