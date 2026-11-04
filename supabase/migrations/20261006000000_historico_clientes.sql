-- Busca de histórico por telefone, ignorando espaços, parênteses e hífens.
create index if not exists pedidos_telefone_normalizado_idx
  on public.pedidos ((regexp_replace(coalesce(telefone, ''), '\\D', '', 'g')));

create or replace function public.buscar_historico_cliente(
  p_telefone text,
  p_limite integer default 20
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
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.cliente, p.telefone, p.endereco, p.itens, p.total,
    p.status, p.tipo_entrega, p.taxa_entrega, p.created_at
  from public.pedidos p
  where regexp_replace(coalesce(p.telefone, ''), '\\D', '', 'g') = regexp_replace(coalesce(p_telefone, ''), '\\D', '', 'g')
  order by p.created_at desc
  limit least(greatest(coalesce(p_limite, 20), 1), 50);
$$;

grant execute on function public.buscar_historico_cliente(text, integer) to anon, authenticated;
