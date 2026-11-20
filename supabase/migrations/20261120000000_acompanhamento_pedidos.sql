alter table public.pedidos add column if not exists tracking_token uuid unique;

create or replace function public.expirar_link_acompanhamento_pedido()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.status in ('entregue', 'cancelado') then
    NEW.tracking_token := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists pedidos_expirar_acompanhamento on public.pedidos;
create trigger pedidos_expirar_acompanhamento
before insert or update of status on public.pedidos
for each row execute function public.expirar_link_acompanhamento_pedido();

create or replace function public.acompanhar_pedido_site(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'status', p.status,
    'created_at', p.created_at,
    'historico_status', p.historico_status
  )
  from public.pedidos p
  where p.tracking_token = p_token
    and p.status not in ('entregue', 'cancelado')
    and p.created_at > now() - interval '14 days'
  limit 1;
$$;
revoke all on function public.acompanhar_pedido_site(uuid) from public, authenticated;
grant execute on function public.acompanhar_pedido_site(uuid) to anon;

-- Online checkout guarda o mesmo token no pedido temporário e o copia ao confirmar.
create or replace function public.confirmar_pagamento_pix(
  p_id uuid,
  p_transaction_nsu text,
  p_capture_method text,
  p_receipt_url text
)
returns bigint language plpgsql as $$
declare
  v_pagamento public.pagamentos_pix%rowtype;
  v_pedido_id bigint;
begin
  select * into v_pagamento from public.pagamentos_pix where id = p_id for update;
  if not found then raise exception 'pagamento % não encontrado', p_id; end if;
  if v_pagamento.pedido_id is not null then return v_pagamento.pedido_id; end if;

  insert into public.pedidos (
    cliente, telefone, endereco, itens, total, status, tipo_entrega, taxa_entrega,
    forma_pagamento, pago, tracking_token
  ) values (
    v_pagamento.pedido->>'cliente', v_pagamento.pedido->>'telefone',
    v_pagamento.pedido->>'endereco', v_pagamento.pedido->'itens',
    (v_pagamento.pedido->>'total')::numeric, 'pendente',
    v_pagamento.pedido->>'tipo_entrega', (v_pagamento.pedido->>'taxa_entrega')::numeric,
    case when p_capture_method = 'credit_card' then 'cartao' else 'pix' end,
    true, coalesce((v_pagamento.pedido->>'tracking_token')::uuid, gen_random_uuid())
  ) returning id into v_pedido_id;

  update public.pagamentos_pix set pedido_id = v_pedido_id,
    transaction_nsu = p_transaction_nsu, capture_method = p_capture_method,
    receipt_url = p_receipt_url, pago_em = now() where id = p_id;
  return v_pedido_id;
end;
$$;
revoke execute on function public.confirmar_pagamento_pix(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.confirmar_pagamento_pix(uuid,text,text,text) to service_role;

