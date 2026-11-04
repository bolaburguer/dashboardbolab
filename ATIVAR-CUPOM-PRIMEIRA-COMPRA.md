# Cupom de primeira compra

A nova aba **Cupons** do dashboard configura o código, descrição, desconto percentual ou frete grátis e ativação. O site valida o benefício novamente ao finalizar o pedido. A aplicação é manual pelo cliente, digitando o código.

## Ativação no Supabase

1. No projeto Supabase usado pelos dois aplicativos, executar `supabase/migrations/20261024000000_cupom_primeira_compra.sql` pelo SQL Editor, antes de publicar o novo código. A migração depende das tabelas `pedidos` e `pagamentos_pix` e da função `confirmar_pagamento_pix` já usadas pelo site. Não executar o schema inicial novamente sobre um banco existente.
2. Em Authentication → Users, cadastrar o usuário do responsável pelo painel, se ainda não existir. Usar uma senha própria; não colocá-la no código ou no chat.
3. Autorizar esse usuário como administrador no SQL Editor, substituindo apenas o e-mail:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'EMAIL_DO_RESPONSAVEL';
```

4. Abrir a aba **Cupons**, entrar com esse usuário e salvar a configuração. Se o usuário já estava conectado antes da autorização, sair e entrar novamente para atualizar a sessão. O cupom começa desativado no formulário e só é criado ao salvar. Não há mudança automática em cupons existentes.
5. Publicar site e dashboard após a migração. O site usa a nova função de confirmação online `confirmar_pagamento_com_cupom`, que envolve a confirmação existente sem substituí-la. As chaves privilegiadas continuam somente no servidor.

## Regra por WhatsApp

- DDD obrigatório. Máscaras, espaços e prefixo `+55` são normalizados.
- Um pedido anterior não cancelado, inclusive registrado manualmente no dashboard, impede o benefício.
- Renomear o cupom ou trocar seu benefício não libera outro uso para o mesmo WhatsApp.
- O uso fica registrado separadamente, inclusive se o pedido que usou o cupom for excluído. Cancelar explicitamente esse pedido libera o registro; outros pedidos não cancelados continuam impedindo a primeira compra.
- Operações simultâneas são serializadas por WhatsApp no banco.
- No pagamento online, o benefício é reservado ao criar o checkout e consumido na confirmação. Enquanto esse pagamento estiver em aberto, não é permitido iniciar outro pedido com o mesmo WhatsApp. O link anterior deve ser concluído. Não há liberação automática por prazo, pois um checkout antigo ainda poderia ser pago. Se um checkout for abandonado, o responsável deve verificar/cancelar esse link no provedor antes de qualquer liberação administrativa da reserva; esta versão não inclui cancelamento do provedor pelo painel.
- Se a criação do link falhar sem disponibilizá-lo, a reserva é desfeita.
- A verificação identifica o telefone informado, sem verificação por SMS/OTP da posse do número.

## Verificação local

O teste `test/cupom-primeira-compra-postgres.cjs` usa o PostgreSQL 18 instalado na máquina, em uma instância separada e descartável, na porta 55439. Nunca apontar esse teste para o banco real: ele cria tabelas e funções de cenário.
O script lê os arquivos `test/fixtures/cupom-primeira-compra.sql` e a migração do projeto, executa casos de permissão, primeiro uso, normalização, cancelamento, exclusão, renomeação, concorrência com duas conexões e confirmação online idempotente.

No site, `node --test test/primeira-compra-online.test.cjs` testa o handler real sem criar cobranças externas.
