-- Cartão de crédito no pagamento online do site.
-- O Checkout Integrado da InfinitePay aceita Pix e cartão na mesma tela, então um pagamento
-- de pagamentos_pix pode ter sido feito no cartão. O nome da tabela e das funções continua
-- "pix" para não quebrar o site; o meio usado fica em capture_method ('pix' ou 'credit_card').

-- O pedido passa a entrar com a forma de pagamento que a InfinitePay informou.
create or replace function public.confirmar_pagamento_pix(
  p_id uuid,
  p_transaction_nsu text,
  p_capture_method text,
  p_receipt_url text
)
returns bigint
language plpgsql
as $$
declare
  v_pagamento public.pagamentos_pix%rowtype;
  v_pedido_id bigint;
begin
  select * into v_pagamento from public.pagamentos_pix where id = p_id for update;

  if not found then
    raise exception 'pagamento % não encontrado', p_id;
  end if;

  if v_pagamento.pedido_id is not null then
    return v_pagamento.pedido_id;
  end if;

  insert into public.pedidos (
    cliente, telefone, endereco, itens, total, status,
    tipo_entrega, taxa_entrega, forma_pagamento, pago
  )
  values (
    v_pagamento.pedido->>'cliente',
    v_pagamento.pedido->>'telefone',
    v_pagamento.pedido->>'endereco',
    v_pagamento.pedido->'itens',
    (v_pagamento.pedido->>'total')::numeric,
    'pendente',
    v_pagamento.pedido->>'tipo_entrega',
    (v_pagamento.pedido->>'taxa_entrega')::numeric,
    case when p_capture_method = 'credit_card' then 'cartao' else 'pix' end,
    true
  )
  returning id into v_pedido_id;

  update public.pagamentos_pix
  set pedido_id = v_pedido_id,
      transaction_nsu = p_transaction_nsu,
      capture_method = p_capture_method,
      receipt_url = p_receipt_url,
      pago_em = now()
  where id = p_id;

  return v_pedido_id;
end;
$$;

revoke execute on function public.confirmar_pagamento_pix(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.confirmar_pagamento_pix(uuid, text, text, text)
  to service_role;

-- Pedidos pagos no cartão antes desta migração entraram como Pix.
update public.pedidos pe
set forma_pagamento = 'cartao'
from public.pagamentos_pix p
where p.pedido_id = pe.id
  and p.capture_method = 'credit_card'
  and pe.forma_pagamento = 'pix';

-- A aba Pagamentos passa a mostrar o meio usado. Mudar as colunas de retorno exige
-- recriar a função, e o drop leva o grant junto.
drop function if exists public.listar_pagamentos_pix(timestamptz, timestamptz);

create function public.listar_pagamentos_pix(p_de timestamptz, p_ate timestamptz)
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
  where p.created_at >= p_de and p.created_at < p_ate
  order by p.created_at desc
  limit 1000;
$$;

grant execute on function public.listar_pagamentos_pix(timestamptz, timestamptz) to anon, authenticated;
