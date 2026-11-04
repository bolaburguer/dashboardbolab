import type { Pedido, PedidoItem } from "@/lib/pedidos-types";

export interface CaixaFechamento {
  saldo_inicial: number | null;
  saidas: number | null;
  dinheiro_contado: number | null;
  responsavel: string;
  observacoes: string;
}

export interface FechamentoPedidoDetalhe {
  id: number;
  cliente: string;
  total: number;
  status: string;
  pago: boolean;
  forma_pagamento: string;
  hora: string;
  itens?: PedidoItem[];
  tipo_entrega?: string;
  taxa_entrega?: number | null;
  origem?: string | null;
  cupom_codigo?: string | null;
  cupom_tipo?: string | null;
  subtotal_produtos?: number | null;
  desconto_produtos?: number | null;
  desconto_entrega?: number | null;
}

export interface FechamentoDiario {
  id: number;
  data: string;
  faturado: number;
  recebido: number;
  a_receber: number;
  total_pedidos: number;
  pedidos_entregues: number;
  pedidos_cancelados: number;
  detalhes: FechamentoPedidoDetalhe[];
  created_at: string;
  turno_id: number | null;
  iniciado_em: string | null;
  encerrado_em: string | null;
  caixa?: CaixaFechamento | null;
}

export interface ResumoPeriodo {
  label: string;
  faturado: number;
  recebido: number;
  a_receber: number;
  total_pedidos: number;
  dias_registrados: number;
}

export type FechamentoDiarioInsert = Omit<FechamentoDiario, "id" | "created_at">;

export function rowToFechamento(row: {
  id: number;
  data: string;
  faturado: number;
  recebido: number;
  a_receber: number;
  total_pedidos: number;
  pedidos_entregues: number;
  pedidos_cancelados: number;
  detalhes: unknown;
  created_at: string;
  turno_id?: number | null;
  iniciado_em?: string | null;
  encerrado_em?: string | null;
  caixa?: unknown;
}): FechamentoDiario {
  return {
    ...row,
    faturado: Number(row.faturado),
    recebido: Number(row.recebido),
    a_receber: Number(row.a_receber),
    detalhes: (row.detalhes ?? []) as FechamentoPedidoDetalhe[],
    turno_id: row.turno_id ?? null,
    iniciado_em: row.iniciado_em ?? null,
    encerrado_em: row.encerrado_em ?? null,
    caixa: (row.caixa as CaixaFechamento | null) ?? null,
  };
}

export function pedidosToDetalhes(pedidos: Pedido[]): FechamentoPedidoDetalhe[] {
  return pedidos.map((p) => ({
    id: p.id,
    cliente: p.cliente,
    total: Number(p.total),
    status: p.status,
    pago: p.pago,
    itens: p.itens?.map((i) => ({ ...i })),
    tipo_entrega: p.tipo_entrega,
    taxa_entrega: p.taxa_entrega == null ? null : Number(p.taxa_entrega),
    origem: p.origem ?? null,
    cupom_codigo: p.cupom_codigo,
    cupom_tipo: p.cupom_tipo,
    subtotal_produtos: p.subtotal_produtos,
    desconto_produtos: p.desconto_produtos,
    desconto_entrega: p.desconto_entrega,
    forma_pagamento: p.forma_pagamento,
    hora: new Date(p.created_at).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }),
  }));
}

export function buildFechamentoFromPedidos(
  data: string,
  pedidos: Pedido[],
  turno?: { id: number; iniciado_em: string; encerrado_em: string },
  caixa?: CaixaFechamento,
): FechamentoDiarioInsert {
  const ativos = pedidos.filter((p) => p.status !== "cancelado");
  return {
    data,
    faturado: ativos.reduce((s, p) => s + Number(p.total), 0),
    recebido: ativos.filter((p) => p.pago).reduce((s, p) => s + Number(p.total), 0),
    a_receber: ativos.filter((p) => !p.pago).reduce((s, p) => s + Number(p.total), 0),
    total_pedidos: pedidos.length,
    pedidos_entregues: pedidos.filter((p) => p.status === "entregue").length,
    pedidos_cancelados: pedidos.filter((p) => p.status === "cancelado").length,
    detalhes: pedidosToDetalhes(pedidos),
    turno_id: turno?.id ?? null,
    iniciado_em: turno?.iniciado_em ?? null,
    encerrado_em: turno?.encerrado_em ?? null,
    caixa: caixa ?? null,
  };
}
