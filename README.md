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
4. Em **Project Settings → API**, copie:
   - **Project URL**
   - **Publishable key** (`sb_publishable_...`) ou **anon key** (`eyJ...`)

## 2. Variáveis de ambiente (local)

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

## 3. Desenvolvimento local

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## 4. Deploy no Netlify

### Passo a passo

1. Suba o código para GitHub.
2. No Netlify: **Add new site → Import an existing project**.
3. **Importante:** em **Site configuration → Environment variables**, adicione:

| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://SEU-PROJETO.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable ou anon key |
| `SUPABASE_URL` | mesma URL |
| `SUPABASE_PUBLISHABLE_KEY` | mesma key |

4. **Depois de salvar as variáveis, faça um novo deploy** (Deploys → Trigger deploy → Deploy site).  
   As variáveis `VITE_*` entram no JavaScript **no momento do build**. Se você adicionou depois do primeiro deploy, o site quebra até rebuildar.

5. Confirme que o banco tem a tabela `pedidos` (passo 1).

### Checklist se der erro

- [ ] `schema.sql` executado no Supabase
- [ ] 4 variáveis acima configuradas no Netlify
- [ ] Novo deploy feito **depois** de configurar as variáveis
- [ ] Build no Netlify terminou sem erro

## Estrutura

- `src/routes/` — páginas
- `src/integrations/supabase/` — cliente Supabase
- `supabase/schema.sql` — schema do banco
