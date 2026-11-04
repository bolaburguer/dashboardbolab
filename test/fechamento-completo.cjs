const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");
const cache = {};
function load(name) {
  const file = path.resolve(__dirname, "../src/lib", name + ".ts");
  if (cache[file]) return cache[file];
  const out = {};
  cache[file] = out;
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const req = Module.createRequire(file);
  new Function("exports", "require", code)(out, (n) =>
    n.startsWith("@/lib/") ? load(n.slice(6)) : n.startsWith("./") ? load(n.slice(2)) : req(n),
  );
  return out;
}
const { reportSummary, couponLabel } = load("fechamento-report");
const { buildFechamentoFromPedidos, rowToFechamento } = load("fechamento-types");
const order = (patch = {}) => ({
  id: 1,
  cliente: "Teste",
  hora: "19:30",
  created_at: "2026-11-03T22:30:00Z",
  total: 89.6,
  status: "entregue",
  pago: true,
  forma_pagamento: "dinheiro",
  taxa_entrega: 5,
  desconto_produtos: 9.4,
  desconto_entrega: 0,
  cupom_codigo: "PRIMEIRA10",
  cupom_tipo: "percentual",
  itens: [{ nome: "Lanche", quantidade: 2, preco: 47, observacao: "Adicional já incluído" }],
  ...patch,
});
test("totais em centavos, cancelados fora dos benefícios e caixa", () => {
  const r = reportSummary({
    detalhes: [
      order(),
      order({
        id: 2,
        total: 94,
        pago: false,
        desconto_produtos: 0,
        desconto_entrega: 5,
        cupom_tipo: "frete_gratis",
      }),
      order({ id: 3, total: 100, status: "cancelado" }),
    ],
    caixa: { saldo_inicial: 100, saidas: 20, dinheiro_contado: 169.6 },
  });
  assert.equal(r.faturado, 183.6);
  assert.equal(r.recebido, 89.6);
  assert.equal(r.pendente, 94);
  assert.equal(r.descontos, 14.4);
  assert.equal(r.frete, 5);
  assert.equal(r.pedidosCupom, 2);
  assert.equal(r.fretesGratis, 1);
  assert.equal(r.esperado, 169.6);
  assert.equal(r.diferenca, 0);
  assert.equal(r.produtos[0].quantidade, 4);
});
test("legado não vira cupom ausente/benefício zero", () => {
  const p = { id: 1, total: 50, status: "entregue", pago: false, forma_pagamento: "pix" };
  const r = reportSummary({ detalhes: [p] });
  assert.equal(r.descontos, null);
  assert.equal(r.frete, null);
  assert.equal(r.pedidosCupom, null);
  assert.equal(r.itensCompletos, false);
  assert.equal(r.esperado, null);
  assert.equal(couponLabel({ ...p, cupom_codigo: null }), "Não informado");
});
test("snapshot preserva itens e adicionais sem dobrar o preço", () => {
  const p = order();
  const f = buildFechamentoFromPedidos("2026-11-03", [p]);
  p.itens[0].nome = "Alterado";
  assert.equal(f.detalhes[0].itens[0].nome, "Lanche");
  assert.equal(reportSummary(f).produtos[0].valor, 94);
  assert.equal(rowToFechamento({ ...f, id: 1, created_at: "" }).caixa, null);
});
test("exporta Excel e PDF reais com valores, cupom e paginação", async () => {
  const f = {
    ...buildFechamentoFromPedidos("2026-11-03", [order(), order({ id: 2, pago: false })]),
    id: 1,
    created_at: new Date().toISOString(),
  };
  const { buildFechamentoWorkbook } = load("fechamento-export");
  const wb = await buildFechamentoWorkbook(f);
  const bytes = await wb.xlsx.writeBuffer();
  const ExcelJS = require("exceljs");
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(bytes);
  assert.equal(reopened.getWorksheet("Resumo").getCell("B6").value, 179.2);
  assert.equal(reopened.getWorksheet("Entregas e cupons").getCell("B6").value, "PRIMEIRA10");
  assert.equal(reopened.getWorksheet("Itens por pedido").getCell("E6").value, 94);
  const { buildFechamentoPdf } = load("fechamento-pdf");
  const doc = buildFechamentoPdf(f);
  assert.ok(doc.getNumberOfPages() >= 2);
  const dir = path.join(__dirname, "../.qa");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "fechamento.xlsx"), Buffer.from(bytes));
  fs.writeFileSync(path.join(dir, "fechamento.pdf"), Buffer.from(doc.output("arraybuffer")));
});
test('período mantém caixas por turno e distingue a data dos pedidos',()=>{
  const f={...buildFechamentoFromPedidos('2026-11-03',[order()]),id:1,created_at:'',caixa:{saldo_inicial:10,saidas:0,dinheiro_contado:99.6,responsavel:'Teste',observacoes:''}};
  const {periodoReport}=load('fechamento-export');const {fechamento,tables}=periodoReport([f,{...f,id:2,data:'2026-11-04'}]);
  assert.equal(fechamento.faturado,179.2);assert.match(fechamento.detalhes[1].hora,/2026-11-04/);assert.equal(tables.find(t=>t.title==='Caixas do período').rows.length,2);
});
