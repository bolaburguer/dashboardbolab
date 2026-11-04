begin;
alter table public.fechamentos_diarios add column if not exists caixa jsonb;
alter table public.pedidos
  add column if not exists origem text,
  add column if not exists cupom_codigo text,
  add column if not exists cupom_tipo text,
  add column if not exists subtotal_produtos numeric(12,2),
  add column if not exists desconto_produtos numeric(12,2),
  add column if not exists desconto_entrega numeric(12,2);

-- Grava os valores do benefício na criação, sem consultar preços atuais no relatório.
-- Não reconstitui nem altera pedidos antigos.
create or replace function public.snapshot_beneficio_relatorio(p jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare subtotal numeric; frete numeric; desconto numeric; tipo text; v_codigo text;
begin
  select round(sum((i->>'preco')::numeric * (i->>'quantidade')::numeric),2)
    into subtotal from jsonb_array_elements(coalesce(p->'itens','[]'::jsonb)) i;
  frete := (p->>'taxa_entrega')::numeric;
  if subtotal is null or frete is null or p->>'total' is null then return p; end if;
  desconto := round(subtotal + frete - (p->>'total')::numeric,2);
  v_codigo := nullif(p->>'cupom_codigo','');
  if v_codigo is not null then
    select c.tipo_desconto into tipo from public.cupons c where upper(c.codigo)=upper(v_codigo) limit 1;
    if tipo is null or desconto < 0 or (tipo='frete_gratis' and desconto <> frete) then return p; end if;
  elsif desconto <> 0 then
    return p; -- Desconto sem origem identificada: manter desconhecido.
  end if;
  return p || jsonb_build_object('subtotal_produtos',subtotal,'cupom_codigo',v_codigo,'cupom_tipo',tipo,
    'desconto_produtos',case when tipo='percentual' then desconto else 0 end,
    'desconto_entrega',case when tipo='frete_gratis' then desconto else 0 end);
end $$;

create or replace function public.snapshot_pagamento_relatorio()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.pedido := public.snapshot_beneficio_relatorio(new.pedido) || jsonb_build_object('origem','site');
  return new;
end $$;
drop trigger if exists snapshot_pagamento_relatorio on public.pagamentos_pix;
create trigger snapshot_pagamento_relatorio before insert on public.pagamentos_pix
for each row execute function public.snapshot_pagamento_relatorio();

create or replace function public.snapshot_pedido_relatorio()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare p jsonb; pagamento jsonb; campo text;
begin
  if nullif(current_setting('app.pagamento_primeira_compra',true),'') is not null then
    select pedido into pagamento from public.pagamentos_pix
      where id = current_setting('app.pagamento_primeira_compra',true)::uuid;
  end if;
  p := to_jsonb(new);
  if pagamento is not null then
    foreach campo in array array['origem','cupom_codigo','cupom_tipo','subtotal_produtos','desconto_produtos','desconto_entrega'] loop
      if pagamento ? campo then p := jsonb_set(p,array[campo],pagamento->campo); end if;
    end loop;
  else
    p := public.snapshot_beneficio_relatorio(p);
  end if;
  new := jsonb_populate_record(new,p);
  return new;
end $$;
drop trigger if exists zz_snapshot_pedido_relatorio on public.pedidos;
create trigger zz_snapshot_pedido_relatorio before insert on public.pedidos
for each row execute function public.snapshot_pedido_relatorio();

-- Fechamento e encerramento são atômicos. Usa permissões/RLS do usuário conectado.
create or replace function public.encerrar_turno_com_relatorio(p_turno_id bigint,p_caixa jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare t public.turnos; f public.fechamentos_diarios; fim timestamptz := clock_timestamp();
  v_detalhes jsonb; campo text;
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','') <> 'admin' then
    raise exception 'Entre com uma conta de administrador para encerrar o turno.';
  end if;
  if nullif(trim(p_caixa->>'responsavel'),'') is null then raise exception 'Informe o responsável.'; end if;
  foreach campo in array array['saldo_inicial','saidas','dinheiro_contado'] loop
    if p_caixa->>campo is not null and ((p_caixa->>campo)::numeric < 0 or (p_caixa->>campo)::numeric::text in ('NaN','Infinity','-Infinity')) then
      raise exception 'Valores de caixa inválidos.';
    end if;
  end loop;
  select * into t from public.turnos where id=p_turno_id for update;
  if not found or t.encerrado_em is not null then raise exception 'Turno não está aberto. Atualize a página.'; end if;
  if exists(select 1 from public.fechamentos_diarios where turno_id=t.id) then raise exception 'Turno já possui fechamento.'; end if;
  -- Bloqueia gravações durante o snapshot para não deixar pedidos fora do fechamento.
  lock table public.pedidos in share mode;
  fim := clock_timestamp();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'cliente',p.cliente,'total',p.total,'status',p.status,'pago',p.pago,
    'forma_pagamento',p.forma_pagamento,'hora',to_char(p.created_at at time zone 'America/Sao_Paulo','HH24:MI'),
    'itens',p.itens,'tipo_entrega',p.tipo_entrega,'taxa_entrega',p.taxa_entrega,'origem',p.origem,
    'cupom_codigo',p.cupom_codigo,'cupom_tipo',p.cupom_tipo,'subtotal_produtos',p.subtotal_produtos,
    'desconto_produtos',p.desconto_produtos,'desconto_entrega',p.desconto_entrega
  ) order by p.created_at,p.id),'[]'::jsonb) into v_detalhes
  from public.pedidos p where p.created_at >= t.iniciado_em and p.created_at <= fim;
  insert into public.fechamentos_diarios(data,faturado,recebido,a_receber,total_pedidos,pedidos_entregues,pedidos_cancelados,detalhes,turno_id,iniciado_em,encerrado_em,caixa)
  select (fim at time zone 'America/Sao_Paulo')::date,
    coalesce(sum((p->>'total')::numeric) filter(where p->>'status'<>'cancelado'),0),
    coalesce(sum((p->>'total')::numeric) filter(where p->>'status'<>'cancelado' and (p->>'pago')::boolean),0),
    coalesce(sum((p->>'total')::numeric) filter(where p->>'status'<>'cancelado' and not (p->>'pago')::boolean),0),
    count(*),count(*) filter(where p->>'status'='entregue'),count(*) filter(where p->>'status'='cancelado'),
    v_detalhes,t.id,t.iniciado_em,fim,p_caixa from jsonb_array_elements(v_detalhes) p returning * into f;
  update public.turnos set encerrado_em=fim where id=t.id;
  return to_jsonb(f);
end $$;
revoke all on function public.encerrar_turno_com_relatorio(bigint,jsonb) from public,anon;
grant execute on function public.encerrar_turno_com_relatorio(bigint,jsonb) to authenticated;
commit;
