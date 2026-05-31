# Bola Burger

Sistema de pedidos para hamburgueria, com Supabase e deploy no Netlify.

## Pré-requisitos

- [Bun](https://bun.sh) ou Node.js 22+
- Conta no [Supabase](https://supabase.com)
- Conta no [Netlify](https://netlify.com)

## 1. Banco de dados (Supabase)

1. Crie um projeto em [supabase.com/dashboard](https://supabase.com/dashboard).
2. Abra **SQL Editor** → **New query**.
3. Cole e execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql).
4. Em **Project Settings → API**, copie:
   - **Project URL**
   - **anon public** key
   - **Project ID** (ref do projeto, ex.: `abcdefghijklmnop`)

## 2. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha com os dados do seu projeto Supabase:

```bash
cp .env.example .env
```

## 3. Desenvolvimento local

```bash
bun install
bun run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## 4. Deploy no Netlify

### Opção A — Git (recomendado)

1. Suba o código para GitHub/GitLab/Bitbucket.
2. No Netlify: **Add new site → Import an existing project**.
3. O `netlify.toml` já define build e publish.
4. Em **Site configuration → Environment variables**, adicione:

| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key |
| `VITE_SUPABASE_PROJECT_ID` | project ref |
| `SUPABASE_URL` | mesma URL |
| `SUPABASE_PUBLISHABLE_KEY` | mesma anon key |

5. Faça deploy. Cada push na branch principal gera um novo deploy.

### Opção B — CLI

```bash
bun install
npx netlify login
npx netlify init
npx netlify deploy --prod
```

## Estrutura

- `src/routes/` — páginas (TanStack Router)
- `src/integrations/supabase/` — cliente Supabase
- `supabase/schema.sql` — schema do banco
- `supabase/migrations/` — migrations originais (referência)

## Notas

- O app não depende mais do Lovable; o build usa Vite + TanStack Start + plugin oficial Netlify.
- Realtime está habilitado na tabela `pedidos` para atualizações ao vivo.
- RLS está aberto para `anon`/`authenticated` (adequado para uso interno; restrinja em produção se necessário).
