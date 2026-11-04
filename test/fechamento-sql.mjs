import fs from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql as $$ select '2954a822-3f08-4bc6-add8-7935768cc9b7'::uuid $$;
create function auth.jwt() returns jsonb language sql as $$ select '{"app_metadata":{"role":"admin"}}'::jsonb $$;
create table cupons(codigo text,tipo_desconto text);
insert into cupons values('PRIMEIRA10','percentual'),('FRETEGRATIS','frete_gratis');
create table turnos(id bigint generated always as identity primary key,iniciado_em timestamptz default now(),encerrado_em timestamptz);
create table pedidos(id bigint generated always as identity primary key,cliente text,total numeric,status text,pago boolean,forma_pagamento text,created_at timestamptz default now(),itens jsonb,tipo_entrega text,taxa_entrega numeric);
create table pagamentos_pix(id uuid primary key,pedido jsonb);
create table fechamentos_diarios(id bigint generated always as identity primary key,data date,faturado numeric,recebido numeric,a_receber numeric,total_pedidos int,pedidos_entregues int,pedidos_cancelados int,detalhes jsonb,turno_id bigint,iniciado_em timestamptz,encerrado_em timestamptz,created_at timestamptz default now());`);
const migration = await fs.readFile(
  new URL("../supabase/migrations/20261103000000_relatorio_completo.sql", import.meta.url),
  "utf8",
);
await db.exec(migration);
await db.exec(migration);
await db.exec(`insert into turnos(iniciado_em) values(now()-interval '1 hour');
insert into pedidos(cliente,total,status,pago,forma_pagamento,itens,tipo_entrega,taxa_entrega,cupom_codigo) values
('Teste',89.6,'entregue',true,'dinheiro','[{"nome":"Lanche","quantidade":2,"preco":47}]','entrega',5,'PRIMEIRA10');`);
let p = (await db.query("select * from pedidos")).rows[0];
assert.equal(Number(p.desconto_produtos), 9.4);
assert.equal(Number(p.desconto_entrega), 0);
const payment = "11111111-1111-4111-8111-111111111111";
await db.query(`insert into pagamentos_pix values($1,$2::jsonb)`, [
  payment,
  JSON.stringify({
    cliente: "Online",
    total: 94,
    itens: [{ nome: "Lanche", quantidade: 2, preco: 47 }],
    taxa_entrega: 5,
    cupom_codigo: "FRETEGRATIS",
  }),
]);
await db.exec(`update cupons set tipo_desconto='percentual' where codigo='FRETEGRATIS'`);
await db.query(`select set_config('app.pagamento_primeira_compra',$1,false)`, [payment]);
await db.exec(
  `insert into pedidos(cliente,total,status,pago,forma_pagamento,itens,tipo_entrega,taxa_entrega) values ('Online',94,'entregue',false,'pix','[{"nome":"Lanche","quantidade":2,"preco":47}]','entrega',5)`,
);
p = (await db.query("select * from pedidos order by id desc limit 1")).rows[0];
assert.equal(p.cupom_codigo, "FRETEGRATIS");
assert.equal(Number(p.desconto_entrega), 5);
assert.equal(p.cupom_tipo, "frete_gratis");
const caixa = {
  saldo_inicial: 100,
  saidas: 0,
  dinheiro_contado: 189.6,
  responsavel: "Responsável",
  observacoes: "",
};
const f = (
  await db.query(`select public.encerrar_turno_com_relatorio(1,$1::jsonb) as f`, [
    JSON.stringify(caixa),
  ])
).rows[0].f;
assert.equal(Number(f.faturado), 183.6);
assert.equal(f.detalhes.length, 2);
assert.equal(f.detalhes[0].itens[0].nome, "Lanche");
assert.equal(f.caixa.responsavel, "Responsável");
assert.ok((await db.query("select encerrado_em from turnos")).rows[0].encerrado_em);
await assert.rejects(
  db.query(`select public.encerrar_turno_com_relatorio(1,$1::jsonb)`, [JSON.stringify(caixa)]),
);
assert.equal((await db.query("select count(*)::int as n from fechamentos_diarios")).rows[0].n, 1);
await db.exec(
  `create or replace function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;`,
);
await assert.rejects(
  db.query(`select public.encerrar_turno_com_relatorio(1,$1::jsonb)`, [JSON.stringify(caixa)]),
);
console.log(
  "SQL: migração repetível, snapshot de cupom, confirmação online, fechamento atômico e autorização OK",
);
await db.close();
