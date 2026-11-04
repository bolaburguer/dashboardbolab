import type { FechamentoDiario } from "./fechamento-types";
import { reportSummary, couponLabel, sumMoney } from "./fechamento-report";
import { formatBRL, STATUS_META, FORMA_PAGAMENTO_META } from "./pedidos-types";
import type { PedidoStatus, FormaPagamento } from "./pedidos-types";

export const paymentLabel = (x: string) => FORMA_PAGAMENTO_META[x as FormaPagamento]?.label ?? x;
export const statusLabel = (x: string) => STATUS_META[x as PedidoStatus]?.label ?? x;
export const valueLabel = (x: number | null | undefined) =>
  x == null ? "Não informado" : formatBRL(x);
type Cell = string | number;
export interface ReportTable {
  title: string;
  headers: string[];
  rows: Cell[][];
  money?: number[];
  monetaryRows?: number[];
}
export function reportTables(f: FechamentoDiario): ReportTable[] {
  const r = reportSummary(f);
  return [
    {
      title: "Resumo",
      headers: ["Indicador", "Valor"],
      rows: [
        ["Total vendido", f.faturado],
        ["Pago no sistema", f.recebido],
        ["Pendente", f.a_receber],
        ["Pedidos", f.total_pedidos],
        ["Entregues", f.pedidos_entregues],
        ["Cancelados", f.pedidos_cancelados],
        ["Ticket médio (não cancelados)", r.ticket],
        ["Percentual pago", `${(r.percentualPago * 100).toFixed(1)}%`],
        ["Entrega cobrada", r.frete ?? "Não informado"],
        ["Desconto em produtos", r.descontoProdutos ?? "Não informado"],
        ["Desconto em entrega", r.descontoEntrega ?? "Não informado"],
        ["Descontos totais", r.descontos ?? "Não informado"],
        ["Pedidos com cupom", r.pedidosCupom ?? "Não informado"],
        ["Fretes grátis por cupom", r.fretesGratis ?? "Não informado"],
        [
          "Turno iniciado",
          f.iniciado_em
            ? new Date(f.iniciado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
            : "Não informado",
        ],
        [
          "Turno encerrado",
          f.encerrado_em
            ? new Date(f.encerrado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
            : "Não informado",
        ],
      ],
      money: [1],
      monetaryRows: [0, 1, 2, 6, 8, 9, 10, 11],
    },
    {
      title: "Pagamentos",
      headers: ["Forma", "Vendido", "Pago no sistema", "Pendente"],
      rows: r.pagamentos.map((p) => [paymentLabel(p.forma), p.vendido, p.pago, p.pendente]),
      money: [1, 2, 3],
    },
    {
      title: "Pendências",
      headers: ["Pedido", "Cliente", "Pagamento", "Valor"],
      rows: r.pendentes.map((p) => [p.id, p.cliente, paymentLabel(p.forma_pagamento), p.total]),
      money: [3],
    },
    {
      title: "Caixa",
      headers: ["Componente", "Valor"],
      rows: [
        ["Responsável", f.caixa?.responsavel || "Não informado"],
        ["Saldo inicial", f.caixa?.saldo_inicial ?? "Não informado"],
        ["Entradas em dinheiro", r.entrada],
        ["Saídas e sangrias", f.caixa?.saidas ?? "Não informado"],
        ["Saldo esperado", r.esperado ?? "Não informado"],
        ["Dinheiro contado", f.caixa?.dinheiro_contado ?? "Não informado"],
        ["Diferença", r.diferenca ?? "Não informado"],
        [
          "Conferência",
          r.diferenca == null
            ? "Incompleta"
            : r.diferenca === 0
              ? "Conferido"
              : "Revisar diferença",
        ],
        ["Observações", f.caixa?.observacoes || "—"],
      ],
      money: [1],
    },
    {
      title: "Pedidos",
      headers: [
        "Pedido",
        "Hora",
        "Cliente",
        "Status",
        "Pagamento",
        "Situação",
        "Total",
        "Origem",
        "Modalidade",
      ],
      rows: f.detalhes.map((p) => [
        p.id,
        p.hora,
        p.cliente,
        statusLabel(p.status),
        paymentLabel(p.forma_pagamento),
        p.pago ? "Pago" : "Pendente",
        p.total,
        p.origem || "Não informado",
        p.tipo_entrega || "Não informado",
      ]),
      money: [6],
    },
    {
      title: "Entregas e cupons",
      headers: [
        "Pedido",
        "Cupom",
        "Tipo",
        "Entrega original",
        "Desc. produtos",
        "Desc. entrega",
        "Entrega cobrada",
        "Total final",
      ],
      rows: f.detalhes.map((p) => [
        p.id,
        couponLabel(p),
        p.cupom_tipo === undefined ? "Não informado" : p.cupom_tipo || "Sem cupom",
        p.taxa_entrega ?? "Não informado",
        p.desconto_produtos ?? "Não informado",
        p.desconto_entrega ?? "Não informado",
        p.taxa_entrega == null || p.desconto_entrega == null
          ? "Não informado"
          : p.taxa_entrega - p.desconto_entrega,
        p.total,
      ]),
      money: [3, 4, 5, 6, 7],
    },
    {
      title: "Itens por pedido",
      headers: ["Pedido", "Produto", "Quantidade", "Preço unitário", "Subtotal", "Observações"],
      rows: f.detalhes.flatMap((p) =>
        p.itens?.length
          ? p.itens.map((i) => [
              p.id,
              i.nome,
              i.quantidade,
              i.preco,
              i.quantidade * i.preco,
              i.observacao || "—",
            ])
          : [[p.id, "Itens não informados", "", "", "", ""]],
      ),
      money: [3, 4],
    },
    {
      title: "Produtos vendidos",
      headers: ["Produto", "Quantidade", "Valor antes dos cupons"],
      rows: r.produtos.map((p) => [p.nome, p.quantidade, p.valor]),
      money: [2],
    },
  ];
}
export function periodoReport(fechamentos: FechamentoDiario[]) {
  const f: FechamentoDiario = {
    id: 0,
    data: fechamentos[0]?.data ?? new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    turno_id: null,
    iniciado_em: null,
    encerrado_em: null,
    faturado: sumMoney(fechamentos.map((f) => f.faturado)),
    recebido: sumMoney(fechamentos.map((f) => f.recebido)),
    a_receber: sumMoney(fechamentos.map((f) => f.a_receber)),
    total_pedidos: fechamentos.reduce((s, f) => s + f.total_pedidos, 0),
    pedidos_entregues: fechamentos.reduce((s, f) => s + f.pedidos_entregues, 0),
    pedidos_cancelados: fechamentos.reduce((s, f) => s + f.pedidos_cancelados, 0),
    detalhes: fechamentos.flatMap((f) =>
      f.detalhes.map((p) => ({ ...p, hora: `${f.data} ${p.hora}` })),
    ),
  };
  const tables = reportTables(f).filter((t) => t.title !== "Caixa");
  tables.splice(1, 0, {
    title: "Por fechamento",
    headers: ["Data", "Turno", "Vendido", "Pago no sistema", "Pendente", "Responsável"],
    rows: fechamentos.map((f) => [
      f.data,
      f.turno_id ?? "Não informado",
      f.faturado,
      f.recebido,
      f.a_receber,
      f.caixa?.responsavel || "Não informado",
    ]),
    money: [2, 3, 4],
  });
  tables.push({
    title: "Caixas do período",
    headers: ["Data", "Saldo inicial", "Saídas", "Contado", "Esperado", "Diferença"],
    rows: fechamentos.map((f) => {
      const r = reportSummary(f);
      return [
        f.data,
        f.caixa?.saldo_inicial ?? "Não informado",
        f.caixa?.saidas ?? "Não informado",
        f.caixa?.dinheiro_contado ?? "Não informado",
        r.esperado ?? "Não informado",
        r.diferenca ?? "Não informado",
      ];
    }),
    money: [1, 2, 3, 4, 5],
  });
  return { fechamento: f, tables };
}
export async function buildFechamentoWorkbook(
  f: FechamentoDiario,
  tables = reportTables(f),
  caption = `Fechamento ${f.data}`,
) {
  const excelModule = await import("exceljs");
  const ExcelJS = excelModule.default ?? excelModule;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Bola Burguer";
  for (const table of tables) {
    const sh = wb.addWorksheet(table.title, {
      views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
    });
    sh.addRow(["Bola Burguer — " + table.title]);
    sh.mergeCells(1, 1, 1, table.headers.length);
    sh.addRow([
      `${caption} | Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    ]);
    sh.mergeCells(2, 1, 2, table.headers.length);
    sh.addRow([
      "Valores ausentes: não informado. Preços unitários já incluem adicionais quando embutidos.",
    ]);
    sh.mergeCells(3, 1, 3, table.headers.length);
    sh.addRow([]);
    sh.addRow(table.headers);
    sh.addRows(table.rows);
    sh.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: table.headers.length } };
    sh.columns.forEach((col, j) => {
      col.width = /Cliente|Produto|Observa/.test(table.headers[j]) ? 42 : j === 0 ? 30 : 25;
    });
    sh.eachRow((row, n) => {
      row.height = n === 1 ? 30 : 28;
      if (n > 5)
        row.eachCell((cell, col) => {
          row.height = Math.max(
            row.height ?? 28,
            Math.ceil(String(cell.value ?? "").length / ((sh.getColumn(col).width ?? 25) - 2)) *
              15 +
              8,
          );
        });
      row.eachCell((c) => {
        c.font = { name: "Arial", size: 11 };
        c.alignment = { vertical: "middle", wrapText: true };
        if (n === 5) {
          c.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF253442" } };
        } else if (n > 5 && n % 2 === 0)
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F4F6" } };
      });
    });
    sh.getRow(1).font = { name: "Arial", size: 16, bold: true, color: { argb: "FFA84716" } };
    for (const j of table.money ?? [])
      for (let n = 6; n <= sh.rowCount; n++)
        if (
          typeof sh.getCell(n, j + 1).value === "number" &&
          (!table.monetaryRows || table.monetaryRows.includes(n - 6))
        )
          sh.getCell(n, j + 1).numFmt = '"R$" #,##0.00';
    sh.pageSetup = {
      paperSize: 9,
      orientation: table.headers.length > 5 ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
  }
  return wb;
}
export async function downloadFechamentoExcel(f: FechamentoDiario) {
  const wb = await buildFechamentoWorkbook(f);
  await downloadWorkbook(wb, `fechamento-${f.data}-bolaburguer.xlsx`);
}
export async function downloadPeriodoExcel(titulo: string, fechamentos: FechamentoDiario[]) {
  const { fechamento, tables } = periodoReport(fechamentos);
  const wb = await buildFechamentoWorkbook(fechamento, tables, titulo);
  await downloadWorkbook(wb, `relatorio-${titulo.replace(/[^\p{L}\p{N}]+/gu, "-")}.xlsx`);
}
async function downloadWorkbook(
  wb: Awaited<ReturnType<typeof buildFechamentoWorkbook>>,
  filename: string,
) {
  const bytes = await wb.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(bytes)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
