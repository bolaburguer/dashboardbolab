-- Histórico de Pix online para o dashboard e o app.
-- Devolve só os campos da tela, nunca a linha inteira de pagamentos_pix.
-- Enquanto o dashboard e o app não fazem login, fica liberada para anon, no mesmo nível
-- de exposição de public.pedidos. Quando houver login, trocar o grant para authenticated.
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
  receipt_url text
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
    p.receipt_url
  from public.pagamentos_pix p
  where p.created_at >= p_de and p.created_at < p_ate
  order by p.created_at desc
  limit 1000;
$$;

grant execute on function public.listar_pagamentos_pix(timestamptz, timestamptz) to anon, authenticated;
