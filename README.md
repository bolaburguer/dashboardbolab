# Bola Burger

Sistema de pedidos para hamburgueria, com Supabase e deploy no Netlify.

## Pré-requisitos

- Node.js 22+
- Conta no [Supabase](https://supabase.com)
- Conta no [Netlify](https://netlify.com)

## 1. Banco de dados (Supabase)

1. Crie um projeto em [supabase.com/dashboard](https://supabase.com/dashboard).
2. Abra **SQL Editor** → **New query**.
3. Cole e execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql).
4. Se o projeto **já existia**, rode também [`supabase/migrations/20260601000000_fechamentos_diarios.sql`](supabase/migrations/20260601000000_fechamentos_diarios.sql).
5. Em **Project Settings → API**, copie URL e publishable/anon key.

## 2. Variáveis de ambiente (local)

```bash
cp .env.example .env
```

## 3. Desenvolvimento local

```bash
npm install
npm run dev
```

## 4. Deploy no Netlify

1. Suba o código para GitHub e conecte no Netlify.
2. Variáveis em **Site configuration → Environment variables** (escopo **All**):
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
3. **Deploys → Trigger deploy** após salvar as variáveis.

## Fechamento diário e relatórios

### Fluxo

1. **Iniciar dia** — abre o turno; só então aparecem pedidos e o botão Novo pedido.
2. Registre pedidos durante o expediente.
3. **Encerrar dia** (aba Relatórios) — salva histórico, baixa PDF e fecha o turno.
4. **Iniciar dia** de novo — quando quiser (mesmo dia, outro turno, etc.).

### Relatórios

- **Semanal / Mensal** — soma dos fechamentos no período + PDF
- **Histórico** — todos os turnos encerrados com horário e PDF

> Rode `supabase/migrations/20260602000000_turnos.sql` se o projeto já existia antes desta feature.

## Pagamentos online

O site recebe Pix e cartão de crédito pelo Checkout Integrado da InfinitePay. A aba **Pagamentos** lista os pagamentos feitos pelo site, com o meio usado (Pix ou cartão) e o status pago, aguardando ou abandonado (sem pagamento depois de 1 hora). O pedido entra no dashboard e no app já pago, com a forma de pagamento Pix ou Cartão conforme o que o cliente escolheu no checkout.

A tabela `pagamentos_pix` e as funções `confirmar_pagamento_pix` e `listar_pagamentos_pix` guardam pagamentos dos dois meios. O nome ficou do início, quando só havia Pix.

> Se o projeto já existia, rode em ordem `supabase/migrations/20261010000000_pagamentos_pix.sql`, `supabase/migrations/20261010000001_listar_pagamentos_pix.sql` e `supabase/migrations/20261011000000_pagamento_online_cartao.sql`.

## Estrutura

- `src/routes/` — dashboard
- `src/components/fechamento/` — encerrar dia e histórico
- `src/components/pagamentos/` — histórico de pagamentos online
- `src/lib/fechamento-*.ts` — cálculos e PDF
- `supabase/schema.sql` — schema completo
