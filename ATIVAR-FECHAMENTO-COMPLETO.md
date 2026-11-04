# Fechamento completo

## Ativação

1. No mesmo projeto Supabase usado pelo site e painel, aplicar `supabase/migrations/20261103000000_relatorio_completo.sql` no SQL Editor. Depende das migrações anteriores de turnos, pagamentos online e cupom de primeira compra. Não executar o schema inicial novamente.
2. O responsável deve entrar no painel com uma conta cujo `app_metadata.role` seja `admin`. A tela de entrada existente fica na aba Cupons. Sair e entrar novamente depois de alterar essa permissão.
3. Executar `npm install` e `npm run build` e publicar o dashboard pelo processo habitual. Este pacote não publica nem modifica o Supabase automaticamente.

## Uso

Em Relatórios, visualizar o turno atual. Ao encerrar, preencher responsável, saldo inicial, saídas/sangrias, dinheiro contado e observações. Caixa em branco permanece incompleto; zero é um valor válido. O encerramento salva o relatório e fecha o turno na mesma transação.

No histórico, usar Ver, PDF ou Excel. Relatórios semanais e mensais também têm PDF e Excel, com resumo por fechamento e caixas separados.

## Dados e compatibilidade

- Os detalhes do fechamento guardam os produtos, observações/adicionais já incluídos no preço, frete original e cobrado, modalidade, origem quando registrada, código e tipo de cupom, descontos, status e pagamento.
- Novos pagamentos online preservam os valores do cupom no checkout. Alterar o cupom posteriormente não muda o benefício registrado nessa cobrança. A confirmação deve usar a função `confirmar_pagamento_com_cupom` da migração anterior.
- Novos pedidos do painel registram origem `painel`. Pagamentos online registram origem `site`. Pedidos de outros fluxos sem origem explícita aparecem como não informado.
- Pedidos anteriores à migração não são reescritos. Benefícios não registrados ficam desconhecidos; nenhum zero é inventado. Histórico de fechamentos já salvo continua disponível com os campos originais.
- Os totais excluem pedidos cancelados. O detalhamento mantém esses registros identificados. Valores marcados como pagos não comprovam liquidação bancária nem descontam taxas do cartão.
- O total final já inclui frete e descontos. Frete grátis é desconto da entrega e não deve ser descontado novamente.
- Uma página pode continuar exibindo dados antigos durante o fechamento; a função usa os pedidos atuais no banco para salvar o relatório definitivo.

## Verificação local

`node --test test/fechamento-completo.cjs` testa totais, legado, snapshot e exportações reais.

`test/fechamento-sql.mjs` testa a migração em banco descartável PGlite, sem acessar produção. Para executá-lo, disponibilizar `@electric-sql/pglite` no ambiente de desenvolvimento (ou indicar seu módulo pela variável `PGLITE_MODULE`). Não é dependência do aplicativo publicado.

`npx tsc --noEmit` e `npm run build` verificam tipos e compilação.
