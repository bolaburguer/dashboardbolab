const { execFileSync, execFile } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const psql = 'C:/Program Files/PostgreSQL/18/bin/psql.exe';
const args = ['-X','-qAt','-h','127.0.0.1','-p','55439','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'];
function sql(query) { return execFileSync(psql,[...args,'-c',query],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(); }
function file(name) {
 const local = path.join(__dirname,name);
 const location = fs.existsSync(local) ? local : path.join(__dirname, name === 'fixture.sql' ? 'fixtures/cupom-primeira-compra.sql' : '../supabase/migrations/' + name);
 execFileSync(psql,[...args,'-f',location],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
}
function fails(query,pattern) { assert.throws(()=>sql(query),pattern); }
function asyncSql(query) { return new Promise((resolve,reject)=>execFile(psql,[...args,'-c',query],{encoding:'utf8'},(error,stdout,stderr)=>error?reject(new Error(stderr)):resolve(stdout))); }
const admin = `set role authenticated; set test.uid='00000000-0000-0000-0000-000000000001'; set test.jwt='{"app_metadata":{"role":"admin"}}';`;
const save = (name='BEMVINDO',type='percentual',value=10,active=true)=>`${admin} select public.salvar_cupom_primeira_compra('${name}','Primeira compra','${type}',${value},${active});`;
const validate = (phone,code='BEMVINDO')=>`select public.validar_cupom_site('${code}','${phone}',1)`;
const order = (phone,code='BEMVINDO')=>`insert into public.pedidos(telefone,cupom_codigo) values('${phone}',${code?`'${code}'`:'null'})`;
async function main() {
 assert(sql("select current_setting('data_directory')").replaceAll('\\','/').endsWith('/coupon-work/pg-validation'), 'Use somente a instância temporária de validação, nunca o banco existente.');
 const database = 'coupon_validation_' + Date.now();
 sql('create database ' + database);
 args[args.indexOf('-d') + 1] = database;
 try {
 file('fixture.sql'); file('20261024000000_cupom_primeira_compra.sql');
 // Migração pode ser reaplicada sem duplicar dados e índices.
 file('20261024000000_cupom_primeira_compra.sql');
 fails(`set role anon; select public.salvar_cupom_primeira_compra('X','X','frete_gratis',0,true)`,/permission denied/);
 fails(`set role authenticated; set test.uid='00000000-0000-0000-0000-000000000001'; select public.salvar_cupom_primeira_compra('X','X','frete_gratis',0,true)`,/administrador/);
 sql(save());
 assert.equal(JSON.parse(sql(validate('35999999991'))).valor_desconto,10);
 fails(validate('999999991'),/DDD/);
 sql(order('(35) 99999-9991'));
 fails(validate('+55 35 99999-9991'),/primeira compra/);
 fails(order('5535999999991'),/primeira compra/);
 sql(save('OLAPRIMEIRA'));
 fails(validate('35999999991','OLAPRIMEIRA'),/primeira compra/);
 sql(`delete from public.pedidos where public.normalizar_whatsapp(telefone)='35999999991'`);
 fails(validate('35999999991','OLAPRIMEIRA'),/primeira compra/);
 sql(save());
 sql(order('35999999992',null));
 fails(validate('35999999992'),/primeira compra/);
 sql(`insert into public.pedidos(telefone,status) values('35999999993','cancelado')`);
 sql(validate('35999999993'));
 sql(order('35999999993'));
 sql(`update public.pedidos set status='cancelado' where telefone='35999999993'`);
 sql(validate('35999999993'));
 sql(save('BEMVINDO','frete_gratis',0));
 assert.equal(JSON.parse(sql(validate('35999999994'))).tipo_desconto,'frete_gratis');
 sql(save('BEMVINDO','percentual',17.5));
 assert.equal(JSON.parse(sql(validate('35999999994'))).valor_desconto,17.5);
 fails(save('BEMVINDO','percentual',101),/inválida/);
 sql(save('BEMVINDO','percentual',10,false)); fails(validate('35999999994'),/desativado/); sql(save());
 // Duas conexões reais: só um dos dois pedidos simultâneos deve ser aceito.
 const concurrent = await Promise.allSettled([
   asyncSql(`begin; ${order('35999999995')}; select pg_sleep(0.2); commit;`),
   asyncSql(`begin; ${order('35999999995')}; commit;`)
 ]);
 assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
 const payment='10000000-0000-0000-0000-000000000001';
 sql(`set role service_role; insert into public.pagamentos_pix(id,pedido) values('${payment}','{"telefone":"35999999996","cupom_codigo":"BEMVINDO","itens":[{"quantidade":1}]}')`);
 fails(validate('35999999996'),/pagamento.*aberto/);
 fails(order('35999999996',null),/pagamento.*aberto/);
 fails(`insert into public.pagamentos_pix(id,pedido) values('10000000-0000-0000-0000-000000000099','{"telefone":"35999999996","itens":[{"quantidade":1}]}')`,/pagamento.*aberto/);
 fails(`set role anon; select public.confirmar_pagamento_com_cupom('${payment}','transacao',null,null)`,/permission denied/);
 sql(`set role service_role; select public.confirmar_pagamento_com_cupom('${payment}','transacao',null,null)`);
 sql(`set role service_role; select public.confirmar_pagamento_com_cupom('${payment}','transacao',null,null)`);
 assert.equal(sql(`select count(*) from public.pedidos where telefone='35999999996'`),'1');
 fails(validate('35999999996'),/primeira compra/);
 const failedPayment='10000000-0000-0000-0000-000000000002';
 sql(`insert into public.pagamentos_pix(id,pedido) values('${failedPayment}','{"telefone":"35999999997","cupom_codigo":"BEMVINDO","itens":[{"quantidade":1}]}')`);
 sql(`set role service_role; select public.desfazer_reserva_sem_link('${failedPayment}')`);
 sql(validate('35999999997'));
 sql(`insert into public.pagamentos_pix(id,pedido) values('10000000-0000-0000-0000-000000000098','{"telefone":"35999999998","itens":[{"quantidade":1}]}')`);
 fails(validate('35999999998'),/pagamento.*aberto/);
 console.log('OK: permissões, configuração, normalização de WhatsApp, primeira compra, cancelamento, exclusão, concorrência real e confirmação online idempotente.');
 } finally {
  args[args.indexOf('-d') + 1] = 'postgres';
  sql('drop database ' + database);
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
