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
6. Configure o login da equipe (seção abaixo).

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

## Pedido manual e hambúrguer adicional

No **Novo pedido**, cada item pode ser escolhido do cardápio (`src/lib/cardapio.ts`), que já preenche nome e preço. Nos hambúrgueres aparece a opção **Hambúrguer adicional (+R$ 6,00 por unidade)**, igual à do site: ela soma o valor ao preço do item e escreve na observação o mesmo texto que o site grava ("Adicional: 1 hambúrguer (+R$ 6,00 por unidade)"). Assim o card e a impressão saem iguais para pedido do site e pedido manual.

O cardápio e o preço do adicional também existem no site (`src/lib/menu-data.ts`) e no app (`../app/lib/src/cardapio.dart`). Se um preço mudar, altere nos três.

O app Flutter está em [`../app/`](../app/). Para configurar e executar o dashboard Android, siga [`../app/README.md`](../app/README.md). Ele usa o mesmo Supabase, autenticação da equipe e RLS do dashboard web, com impressão Bluetooth Classic SPP/ESC-POS para a BT-583 de 58 mm.

## Login da equipe

O dashboard e o app pedem e-mail e senha (Supabase Auth). Só entra quem tiver uma linha em `public.equipe`, com o papel `dono`, `dev` ou `atendente`. Por enquanto os três papéis têm acesso total. O papel fica guardado para limitar o atendente no futuro.

A senha só é trocada pelo painel do Supabase (**Authentication → Users → usuário → Reset password** ou definir uma nova). O dashboard e o app não têm opção de trocar senha nem de recuperar por e-mail.

A chave pública fica no JavaScript do site e dentro do app, então quem protege os dados são as policies do banco, não a tela de login. Com o acesso fechado, a chave pública só consegue:

- criar pedido pendente e não pago (pedidos do site com cartão na entrega ou dinheiro);
- ler os turnos, para o site saber se a loja está aberta;
- ler os cupons ativos, para o site aplicar o cupom pelo código;
- chamar `buscar_historico_cliente`, que devolve itens, valor e data, mas nome, telefone e endereço só para a equipe.

### Ativar em um projeto que já existia

A ordem importa: se o acesso for fechado antes do dashboard e do app novos estarem em uso, os dois param de carregar.

1. Rode [`supabase/migrations/20261011000001_equipe.sql`](supabase/migrations/20261011000001_equipe.sql). Não muda nada para o site, o dashboard ou o app atuais.
2. Publique o dashboard com login.
3. Em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up**.
4. Em **Authentication → Users → Add user → Create new user**, crie cada pessoa com e-mail e senha, marcando **Auto Confirm User**.
5. Cadastre cada pessoa na equipe:

   ```sql
   insert into public.equipe (user_id, nome, papel)
   select id, 'Nome', 'dono' from auth.users where email = 'pessoa@exemplo.com';
   ```

6. Instale o app novo em todos os aparelhos e faça login.
7. Só então rode [`supabase/migrations/20261011000002_fechar_acesso_publico.sql`](supabase/migrations/20261011000002_fechar_acesso_publico.sql).

Para tirar o acesso de alguém, apague a linha dela em `public.equipe` (ou o usuário em **Authentication → Users**).

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
- `src/components/auth/` — login da equipe
- `src/components/pagamentos/` — histórico de pagamentos online
- `src/lib/fechamento-*.ts` — cálculos e PDF
- `supabase/schema.sql` — schema completo
