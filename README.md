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

### Fluxo do dia

1. Durante o dia, registre pedidos na aba **Pedidos do dia**.
2. Os cards (Faturado, Recebido, etc.) mostram só o dia atual.
3. Ao final, vá em **Relatórios** → **Encerrar dia**:
   - Salva o resumo no Supabase (`fechamentos_diarios`)
   - Baixa PDF do dia
   - Marca o dia como encerrado (não aceita novos pedidos até amanhã)

### Relatórios

- **Semanal** — soma dos dias fechados na semana (seg–dom)
- **Mensal** — soma do mês calendário
- **Histórico** — todos os fechamentos com botão para baixar PDF de novo

> Semanal e mensal só contam dias **encerrados**. Feche o dia todo dia útil para o relatório ficar completo.

## Estrutura

- `src/routes/` — dashboard
- `src/components/fechamento/` — encerrar dia e histórico
- `src/lib/fechamento-*.ts` — cálculos e PDF
- `supabase/schema.sql` — schema completo
