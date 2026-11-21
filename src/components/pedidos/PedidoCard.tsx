import {
  Clock,
  MapPin,
  Phone,
  Pencil,
  ChefHat,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Printer,
  Truck,
  Store,
  Wallet,
  CreditCard,
  QrCode,
  BadgeCheck,
  CircleDashed,
  MessageCircle,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { Pedido, PedidoStatus, FormaPagamento } from "@/lib/pedidos-types";
import { STATUS_META, FORMA_PAGAMENTO_META, formatBRL } from "@/lib/pedidos-types";
import { printPedido } from "@/lib/print-pedido";

interface Props {
  pedido: Pedido;
  onStatusChange: (id: number, status: PedidoStatus) => void;
  onTogglePago: (id: number, pago: boolean) => void;
  onEdit: (p: Pedido) => void;
  onTrackingLink: (id: number) => Promise<string | null>;
}

const FORMA_ICON: Record<FormaPagamento, typeof Wallet> = {
  pix: QrCode,
  dinheiro: Wallet,
  cartao: CreditCard,
};

function getWhatsAppPhone(telefone: string | null) {
  const digits = telefone?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function getWhatsAppMessage(pedido: Pedido) {
  const statusMessage: Record<PedidoStatus, string> = {
    pendente: "recebido",
    "em-preparacao": "aceito e está em preparação",
    "saiu-para-entrega": "saiu para entrega",
    entregue: "entregue",
    cancelado: "cancelado",
  };
  return `Ola, ${pedido.cliente}! Seu pedido #${pedido.id} na BolaBurguer foi atualizado para: ${statusMessage[pedido.status]}.`;
}

function getWhatsAppUrl(pedido: Pedido) {
  const phone = getWhatsAppPhone(pedido.telefone);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(getWhatsAppMessage(pedido))}`;
}

export function PedidoCard({
  pedido,
  onStatusChange,
  onTogglePago,
  onEdit,
  onTrackingLink,
}: Props) {
  const meta = STATUS_META[pedido.status];
  const hora = new Date(pedido.created_at).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  const FormaIcon = FORMA_ICON[pedido.forma_pagamento] ?? Wallet;
  const whatsappUrl = getWhatsAppUrl(pedido);

  return (
    <Card className="overflow-hidden p-0 border-border/60 hover:shadow-[var(--shadow-soft)] transition-shadow">
      <div className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 flex-wrap">
              <span className="font-mono">#{pedido.id}</span>
              <span>•</span>
              <Clock className="size-3" />
              <span>{hora}</span>
              {pedido.tipo_entrega === "entrega" ? (
                <span className="inline-flex items-center gap-1 text-primary font-medium">
                  • <Truck className="size-3" /> Entrega
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  • <Store className="size-3" /> Retirada
                </span>
              )}
            </div>
            <h3 className="font-semibold text-lg truncate">{pedido.cliente}</h3>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${meta.className}`}
          >
            <span className={`size-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        </div>

        <div className="rounded-lg bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Movimentações do pedido</p>
          <ol className="space-y-1.5 text-xs">
            <li className="flex justify-between gap-3">
              <span>Pedido recebido</span>
              <time dateTime={pedido.created_at} className="tabular-nums">
                {hora}
              </time>
            </li>
            {(pedido.historico_status ?? []).map((evento, index) => (
              <li key={`${evento.registrado_em}-${index}`} className="flex justify-between gap-3">
                <span>
                  {evento.status === "pendente"
                    ? "Reaberto"
                    : (STATUS_META[evento.status]?.label ?? evento.status)}
                </span>
                <time
                  dateTime={evento.registrado_em}
                  title={new Date(evento.registrado_em).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                  className="tabular-nums"
                >
                  {new Date(evento.registrado_em).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Sao_Paulo",
                  })}
                </time>
              </li>
            ))}
          </ol>
        </div>

        {/* Contato */}
        {(pedido.telefone || pedido.endereco) && (
          <div className="space-y-1 text-sm text-muted-foreground">
            {pedido.telefone && (
              <div className="flex items-center gap-2">
                <Phone className="size-3.5" />
                {pedido.telefone}
              </div>
            )}
            {pedido.endereco && (
              <div className="flex items-start gap-2">
                <MapPin className="size-3.5 mt-0.5 shrink-0" />
                <span className="truncate">{pedido.endereco}</span>
              </div>
            )}
          </div>
        )}

        {/* Itens */}
        <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
          {pedido.itens.map((it, i) => (
            <div key={i} className="grid gap-0.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate">
                  <span className="font-semibold text-primary">{it.quantidade}x</span> {it.nome}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {formatBRL(it.preco * it.quantidade)}
                </span>
              </div>
              {it.observacao?.trim() && (
                <p className="pl-5 text-xs text-muted-foreground leading-snug">
                  Obs: {it.observacao}
                </p>
              )}
            </div>
          ))}
          {pedido.taxa_entrega > 0 && (
            <div className="flex items-baseline justify-between gap-3 text-sm border-t pt-1.5 mt-1">
              <span className="text-muted-foreground">Taxa de entrega</span>
              <span className="text-muted-foreground tabular-nums">
                {formatBRL(pedido.taxa_entrega)}
              </span>
            </div>
          )}
        </div>

        {/* Pagamento */}
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <FormaIcon className="size-4 text-muted-foreground" />
            <span className="font-medium">
              {FORMA_PAGAMENTO_META[pedido.forma_pagamento]?.label ?? "—"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onTogglePago(pedido.id, !pedido.pago)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
              pedido.pago
                ? "bg-success/15 text-success border-success/30 hover:bg-success/25"
                : "bg-warning/15 text-warning-foreground border-warning/30 hover:bg-warning/25"
            }`}
            title={pedido.pago ? "Marcar como pendente" : "Marcar como pago"}
          >
            {pedido.pago ? (
              <BadgeCheck className="size-3.5" />
            ) : (
              <CircleDashed className="size-3.5" />
            )}
            {pedido.pago ? "Pago" : "Pendente"}
          </button>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Total
          </span>
          <span className="text-xl font-bold tabular-nums">{formatBRL(Number(pedido.total))}</span>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          {pedido.status === "pendente" && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 min-w-[120px]"
              onClick={() => onStatusChange(pedido.id, "em-preparacao")}
            >
              <ChefHat className="size-4" /> Aceitar
            </Button>
          )}
          {pedido.status === "em-preparacao" && (
            <Button
              size="sm"
              className="flex-1 min-w-[140px] bg-info text-info-foreground hover:bg-info/90"
              onClick={() => onStatusChange(pedido.id, "saiu-para-entrega")}
            >
              <Truck className="size-4" /> Saiu p/ entrega
            </Button>
          )}
          {pedido.status === "saiu-para-entrega" && (
            <Button
              size="sm"
              className="flex-1 min-w-[120px] bg-success text-success-foreground hover:bg-success/90"
              onClick={() => onStatusChange(pedido.id, "entregue")}
            >
              <CheckCircle2 className="size-4" /> Entregue
            </Button>
          )}
          {(pedido.status === "entregue" || pedido.status === "cancelado") && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 min-w-[120px]"
              onClick={() => onStatusChange(pedido.id, "pendente")}
            >
              <RotateCcw className="size-4" /> Reabrir
            </Button>
          )}
          {pedido.status !== "cancelado" && pedido.status !== "entregue" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onStatusChange(pedido.id, "cancelado")}
            >
              <XCircle className="size-4" /> Cancelar
            </Button>
          )}
          {pedido.status !== "cancelado" && pedido.status !== "entregue" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const url = await onTrackingLink(pedido.id);
                  if (!url) return;
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success("Link de acompanhamento copiado!");
                  } catch {
                    window.prompt("Copie o link de acompanhamento:", url);
                  }
                }}
                title={pedido.tracking_token ? "Copiar link de acompanhamento" : "Gerar link de acompanhamento"}
              >
                <Link2 className="size-4" />
                {pedido.tracking_token ? "Copiar rastreio" : "Gerar rastreio"}
              </Button>
              {getWhatsAppPhone(pedido.telefone) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const openWhatsApp = (window as Window & {
                      bolaOpenWhatsApp?: (url: string) => Promise<boolean>;
                    }).bolaOpenWhatsApp;
                    const popup = openWhatsApp ? null : window.open("about:blank", "_blank");
                    let url: string | null;
                    try {
                      url = await onTrackingLink(pedido.id);
                    } catch {
                      popup?.close();
                      toast.error("Não foi possível gerar o link de acompanhamento.");
                      return;
                    }
                    if (!url) {
                      popup?.close();
                      return;
                    }
                    const message = `Olá, ${pedido.cliente}! Acompanhe seu pedido #${pedido.id} da BolaBurguer: ${url}`;
                    const whatsappUrl = `https://wa.me/${getWhatsAppPhone(pedido.telefone)}?text=${encodeURIComponent(message)}`;
                    if (openWhatsApp) {
                      const opened = await openWhatsApp(whatsappUrl);
                      if (opened) toast.success("WhatsApp aberto. Confira a mensagem e toque em Enviar.");
                      else toast.error("Não foi possível abrir o WhatsApp neste computador.");
                      return;
                    }
                    if (popup) {
                      popup.location.href = whatsappUrl;
                      toast.success("WhatsApp aberto. Confira a mensagem e toque em Enviar.");
                      return;
                    }
                    try {
                      await navigator.clipboard.writeText(message);
                      toast.warning("O navegador bloqueou a janela. A mensagem com o rastreio foi copiada; cole-a no WhatsApp.");
                    } catch {
                      window.prompt("Copie a mensagem e cole no WhatsApp:", message);
                    }
                  }}
                  title="Enviar link de acompanhamento pelo WhatsApp"
                >
                  <MessageCircle className="size-4" /> Enviar rastreio
                </Button>
              )}
            </>
          )}
          {whatsappUrl && (
            <Button size="sm" variant="outline" asChild title="Enviar status no WhatsApp">
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => printPedido(pedido)} title="Imprimir">
            <Printer className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(pedido)} title="Editar">
            <Pencil className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
