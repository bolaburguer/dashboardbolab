-- Pix online pelo site (Checkout Integrado da InfinitePay).
-- O pedido fica aqui até o pagamento ser confirmado; só então entra em public.pedidos,
-- já com pago = true. Assim o app e o dashboard nunca veem pedido Pix não pago.
create table if not exists public.pagamentos_pix (
  id uuid primary key default gen_random_uuid(),
  pedido jsonb not null,
  valor_centavos integer not null check (valor_centavos > 0),
  checkout_url text,
  pedido_id bigint references public.pedidos(id),
  transaction_nsu text unique,
  capture_method text,
  receipt_url text,
  pago_em timestamptz,
  created_at timestamptz not null default now()
);

-- Sem policies: anon e authenticated não leem nem escrevem. Só o servidor do site,
-- com a service_role key, acessa esta tabela.
alter table public.pagamentos_pix enable row level security;
revoke all on public.pagamentos_pix from anon, authenticated;
grant all on public.pagamentos_pix to service_role;

-- Cria o pedido a partir de um pagamento já conferido na InfinitePay.
-- Idempotente: se o webhook e a página de retorno chegarem juntos, o lock da linha
-- garante um único pedido.
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
    'pix',
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

-- Funções em public ficam executáveis pela anon key por padrão; esta não pode.
revoke execute on function public.confirmar_pagamento_pix(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.confirmar_pagamento_pix(uuid, text, text, text)
  to service_role;
