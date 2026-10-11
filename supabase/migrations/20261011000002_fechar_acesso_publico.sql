-- Fecha o acesso pela chave pública (anon). A partir daqui o dashboard e o app só
-- funcionam com login de alguém cadastrado em public.equipe.
--
-- RODE SÓ DEPOIS de: dashboard publicado com login, usuários criados e cadastrados em
-- public.equipe, e app novo instalado e logado em todos os aparelhos. Antes disso, o
-- dashboard e o app param de carregar.
--
-- O site continua funcionando sem mudança: a chave pública ainda pode criar pedido não pago,
-- ler cupons ativos, saber se a loja está aberta e ver o histórico por telefone (sem nome,
-- telefone e endereço). O pagamento online usa a service_role e não é afetado.

begin;

-- Remove todas as policies atuais das tabelas operacionais, qualquer que seja o nome.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('pedidos', 'fechamentos_diarios', 'turnos', 'cupons', 'delivery_locations')
  loop
    execute format('drop policy %I on public.%I', v_policy.policyname, v_policy.tablename);
  end loop;
end $$;

-- A chave pública não usa nenhuma sequence além da de pedidos (insert do site).
revoke all on all sequences in schema public from anon;
grant usage on sequence public.pedidos_id_seq to anon;

-- Pedidos: o site só cria pedido pendente e não pago; o resto é da equipe.
revoke all on public.pedidos from anon;
grant insert on public.pedidos to anon;

create policy "pedidos_site_cria_nao_pago" on public.pedidos
  for insert to anon with check (pago = false and status = 'pendente');
create policy "pedidos_equipe" on public.pedidos
  for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());

-- Fechamentos: só a equipe.
revoke all on public.fechamentos_diarios from anon;

create policy "fechamentos_equipe" on public.fechamentos_diarios
  for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());

-- Turnos: o site só lê, para saber se a loja está aberta.
revoke all on public.turnos from anon;
grant select on public.turnos to anon;

create policy "turnos_site_le" on public.turnos
  for select to anon using (true);
create policy "turnos_equipe" on public.turnos
  for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());

-- Cupons: o site só lê os ativos, para aplicar pelo código.
revoke all on public.cupons from anon;
grant select on public.cupons to anon;

create policy "cupons_site_le_ativos" on public.cupons
  for select to anon using (ativo);
create policy "cupons_equipe" on public.cupons
  for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());

-- Localidades de entrega do app (a tabela não existe em todo projeto).
do $$
begin
  if to_regclass('public.delivery_locations') is not null then
    execute 'alter table public.delivery_locations enable row level security';
    execute 'revoke all on public.delivery_locations from anon';
    execute 'grant select, insert, update, delete on public.delivery_locations to authenticated';
    execute 'create policy "delivery_locations_equipe" on public.delivery_locations
      for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe())';
  end if;
end $$;

-- Histórico por telefone: o site continua chamando, mas nome, telefone e endereço só voltam
-- para a equipe.
create or replace function public.buscar_historico_cliente(p_telefone text, p_limite integer default 20)
returns table (
  id bigint, cliente text, telefone text, endereco text, itens jsonb, total numeric,
  status text, tipo_entrega text, taxa_entrega numeric, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id,
    case when public.eh_equipe() then p.cliente end,
    case when public.eh_equipe() then p.telefone end,
    case when public.eh_equipe() then p.endereco end,
    p.itens, p.total, p.status, p.tipo_entrega, p.taxa_entrega, p.created_at
  from public.pedidos p
  where regexp_replace(coalesce(p.telefone, ''), '\\D', '', 'g') = regexp_replace(coalesce(p_telefone, ''), '\\D', '', 'g')
  order by p.created_at desc
  limit least(greatest(coalesce(p_limite, 20), 1), 50);
$$;

grant execute on function public.buscar_historico_cliente(text, integer) to anon, authenticated;

-- Busca de clientes: só a equipe.
create or replace function public.buscar_clientes_por_telefone(p_termo text, p_limite integer default null)
returns table (
  cliente text, telefone text, telefone_normalizado text, ultimo_pedido_em timestamptz
)
language sql stable security definer set search_path = public as $$
  with pedidos_normalizados as (
    select p.cliente, p.telefone,
      regexp_replace(coalesce(p.telefone, ''), '\\D', '', 'g') as telefone_normalizado,
      p.created_at
    from public.pedidos p
    where p.telefone is not null and public.eh_equipe()
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
  limit case when p_limite is null then null else least(greatest(p_limite, 1), 1000) end;
$$;

revoke execute on function public.buscar_clientes_por_telefone(text, integer) from public, anon;
grant execute on function public.buscar_clientes_por_telefone(text, integer) to authenticated;

-- Pagamentos online: só a equipe.
create or replace function public.listar_pagamentos_pix(p_de timestamptz, p_ate timestamptz)
returns table (
  id uuid,
  criado_em timestamptz,
  pago_em timestamptz,
  status text,
  valor numeric,
  cliente text,
  telefone text,
  pedido_id bigint,
  receipt_url text,
  capture_method text
)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.created_at,
    p.pago_em,
    case
      when p.pedido_id is not null then 'pago'
      when p.created_at < now() - interval '1 hour' then 'abandonado'
      else 'aguardando'
    end,
    p.valor_centavos / 100.0,
    p.pedido->>'cliente',
    p.pedido->>'telefone',
    p.pedido_id,
    p.receipt_url,
    p.capture_method
  from public.pagamentos_pix p
  where p.created_at >= p_de and p.created_at < p_ate and public.eh_equipe()
  order by p.created_at desc
  limit 1000;
$$;

revoke execute on function public.listar_pagamentos_pix(timestamptz, timestamptz) from public, anon;
grant execute on function public.listar_pagamentos_pix(timestamptz, timestamptz) to authenticated;

commit;
