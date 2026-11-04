import type { FechamentoDiario, FechamentoPedidoDetalhe } from "./fechamento-types";

export const cents = (n: number) => Math.round(n * 100);
export const sumMoney = (xs: number[]) => xs.reduce((s, n) => s + cents(n), 0) / 100;
export const completeSum = (xs: (number | null | undefined)[]) =>
  xs.every((n) => n != null && Number.isFinite(Number(n))) ? sumMoney(xs.map(Number)) : null;
export function reportSummary(f: Pick<FechamentoDiario, "detalhes" | "caixa">) {
  const active = f.detalhes.filter((p) => p.status !== "cancelado");
  const faturado = sumMoney(active.map((p) => p.total));
  const recebido = sumMoney(active.filter((p) => p.pago).map((p) => p.total));
  const pagamentos = [
    ...new Set(["pix", "cartao", "dinheiro", ...active.map((p) => p.forma_pagamento)]),
  ].map((forma) => {
    const ps = active.filter((p) => p.forma_pagamento === forma);
    return {
      forma,
      vendido: sumMoney(ps.map((p) => p.total)),
      pago: sumMoney(ps.filter((p) => p.pago).map((p) => p.total)),
      pendente: sumMoney(ps.filter((p) => !p.pago).map((p) => p.total)),
    };
  });
  const frete = completeSum(
    active.map((p) =>
      p.taxa_entrega == null || p.desconto_entrega == null
        ? null
        : p.taxa_entrega - p.desconto_entrega,
    ),
  );
  const descontoProdutos = completeSum(active.map((p) => p.desconto_produtos));
  const descontoEntrega = completeSum(active.map((p) => p.desconto_entrega));
  const cuponsConhecidos = active.every(
    (p) =>
      !!p.cupom_codigo ||
      (p.cupom_codigo === null && p.desconto_produtos != null && p.desconto_entrega != null),
  );
  const entrada = pagamentos.find((p) => p.forma === "dinheiro")?.pago ?? 0;
  const caixa = f.caixa;
  const esperado =
    caixa?.saldo_inicial != null && caixa.saidas != null
      ? sumMoney([caixa.saldo_inicial, entrada, -caixa.saidas])
      : null;
  const diferenca =
    esperado != null && caixa?.dinheiro_contado != null
      ? sumMoney([caixa.dinheiro_contado, -esperado])
      : null;
  const produtos = new Map<string, { nome: string; quantidade: number; valor: number }>();
  for (const p of active)
    for (const i of p.itens ?? []) {
      const old = produtos.get(i.nome) ?? { nome: i.nome, quantidade: 0, valor: 0 };
      old.quantidade += i.quantidade;
      old.valor = sumMoney([old.valor, i.preco * i.quantidade]);
      produtos.set(i.nome, old);
    }
  return {
    active,
    faturado,
    recebido,
    pendente: sumMoney([faturado, -recebido]),
    pagamentos,
    frete,
    descontoProdutos,
    descontoEntrega,
    descontos:
      descontoProdutos == null || descontoEntrega == null
        ? null
        : sumMoney([descontoProdutos, descontoEntrega]),
    pedidosCupom: cuponsConhecidos ? active.filter((p) => !!p.cupom_codigo).length : null,
    fretesGratis:
      cuponsConhecidos && active.every((p) => p.cupom_tipo !== undefined)
        ? active.filter((p) => p.cupom_tipo === "frete_gratis").length
        : null,
    entrada,
    esperado,
    diferenca,
    ticket: active.length ? faturado / active.length : 0,
    percentualPago: faturado ? recebido / faturado : 0,
    pendentes: active.filter((p) => !p.pago),
    produtos: [...produtos.values()],
    itensCompletos: active.every((p) => Array.isArray(p.itens)),
  };
}
export const couponLabel = (p: FechamentoPedidoDetalhe) =>
  p.cupom_codigo ||
  (p.cupom_codigo === null && p.desconto_produtos != null && p.desconto_entrega != null
    ? "Sem cupom"
    : "Não informado");
