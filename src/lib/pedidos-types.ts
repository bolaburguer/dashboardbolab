export type PedidoStatus = "pendente" | "em-preparacao" | "entregue" | "cancelado";

export type TipoEntrega = "entrega" | "retirada";

export type FormaPagamento = "pix" | "dinheiro" | "cartao";

export interface PedidoItem {
  nome: string;
  quantidade: number;
  preco: number;
}

export interface Pedido {
  id: number;
  cliente: string;
  telefone: string | null;
  endereco: string | null;
  itens: PedidoItem[];
  total: number;
  status: PedidoStatus;
  tipo_entrega: TipoEntrega;
  taxa_entrega: number;
  forma_pagamento: FormaPagamento;
  pago: boolean;
  created_at: string;
}

export const TAXA_ENTREGA = 7;

export const STATUS_META: Record<PedidoStatus, { label: string; className: string; dot: string }> = {
  pendente: {
    label: "Pendente",
    className: "bg-muted text-foreground border-border",
    dot: "bg-foreground/40",
  },
  "em-preparacao": {
    label: "Em preparação",
    className: "bg-warning/15 text-warning-foreground border-warning/30",
    dot: "bg-warning",
  },
  entregue: {
    label: "Entregue",
    className: "bg-success/15 text-success border-success/30",
    dot: "bg-success",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
};

export const FORMA_PAGAMENTO_META: Record<FormaPagamento, { label: string; short: string }> = {
  pix: { label: "PIX", short: "PIX" },
  dinheiro: { label: "Dinheiro", short: "Dinheiro" },
  cartao: { label: "Cartão", short: "Cartão" },
};

export const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
