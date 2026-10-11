import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/pedidos-types";

type PagamentoPix = {
  id: string;
  criado_em: string;
  pago_em: string | null;
  status: string;
  valor: number;
  cliente: string | null;
  telefone: string | null;
  pedido_id: number | null;
  receipt_url: string | null;
};

const PERIODOS = [
  { value: "hoje", label: "Hoje" },
  { value: "7dias", label: "7 dias" },
  { value: "mes", label: "Este mês" },
] as const;
type Periodo = (typeof PERIODOS)[number]["value"];

const STATUS_FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "pago", label: "Pagos" },
  { value: "aguardando", label: "Aguardando" },
  { value: "abandonado", label: "Abandonados" },
] as const;
type StatusFiltro = (typeof STATUS_FILTROS)[number]["value"];

const STATUS_META: Record<string, { label: string; className: string }> = {
  pago: { label: "Pago", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  aguardando: {
    label: "Aguardando",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  abandonado: { label: "Abandonado", className: "bg-muted text-muted-foreground" },
};

function intervalo(periodo: Periodo) {
  const agora = new Date();
  const de = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (periodo === "7dias") de.setDate(de.getDate() - 6);
  if (periodo === "mes") de.setDate(1);
  const ate = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  return { de: de.toISOString(), ate: ate.toISOString() };
}

function linkWhatsApp(telefone: string | null) {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (digitos.length !== 10 && digitos.length !== 11) return null;
  return `https://wa.me/55${digitos}`;
}

export function PagamentosSection() {
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todos");
  const [pagamentos, setPagamentos] = useState<PagamentoPix[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { de, ate } = intervalo(periodo);
    const { data, error } = await supabase.rpc("listar_pagamentos_pix", { p_de: de, p_ate: ate });
    setCarregando(false);
    if (error) {
      console.error(error);
      toast.error("Não foi possível carregar os pagamentos.");
      return;
    }
    setPagamentos((data ?? []) as PagamentoPix[]);
  }, [periodo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const resumo = useMemo(() => {
    const pagos = pagamentos.filter((p) => p.status === "pago");
    return {
      recebido: pagos.reduce((soma, p) => soma + Number(p.valor), 0),
      pagos: pagos.length,
      gerados: pagamentos.length,
      abandonados: pagamentos.filter((p) => p.status === "abandonado").length,
    };
  }, [pagamentos]);

  const filtrados =
    statusFiltro === "todos" ? pagamentos : pagamentos.filter((p) => p.status === statusFiltro);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Pagamentos Pix online</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pix feitos pelo site. O extrato oficial continua sendo o app da InfinitePay (estornos
            não aparecem aqui).
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={carregar} disabled={carregando}>
          <RefreshCw className={`size-4 ${carregando ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODOS.map((opcao) => (
          <Button
            key={opcao.value}
            size="sm"
            variant={periodo === opcao.value ? "default" : "outline"}
            onClick={() => setPeriodo(opcao.value)}
          >
            {opcao.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Recebido via Pix</p>
          <p className="mt-1 text-2xl font-bold text-primary">{formatBRL(resumo.recebido)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Pix pagos</p>
          <p className="mt-1 text-2xl font-bold">{resumo.pagos}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Pix gerados</p>
          <p className="mt-1 text-2xl font-bold">{resumo.gerados}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Abandonados</p>
          <p className="mt-1 text-2xl font-bold">{resumo.abandonados}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTROS.map((opcao) => (
          <Button
            key={opcao.value}
            size="sm"
            variant={statusFiltro === opcao.value ? "secondary" : "ghost"}
            onClick={() => setStatusFiltro(opcao.value)}
          >
            {opcao.label}
          </Button>
        ))}
      </div>

      {!carregando && filtrados.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          Nenhum pagamento Pix neste período.
        </Card>
      )}

      {filtrados.length > 0 && (
        <Card className="divide-y overflow-hidden">
          {filtrados.map((pagamento) => {
            const meta = STATUS_META[pagamento.status] ?? STATUS_META.abandonado;
            const whatsapp = linkWhatsApp(pagamento.telefone);
            return (
              <div
                key={pagamento.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{pagamento.cliente ?? "Cliente"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(pagamento.criado_em).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {pagamento.pedido_id ? ` · Pedido #${pagamento.pedido_id}` : ""}
                    {pagamento.telefone ? ` · ${pagamento.telefone}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {pagamento.receipt_url?.startsWith("https://") && (
                    <a
                      href={pagamento.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Comprovante <ExternalLink className="size-3" />
                    </a>
                  )}
                  {pagamento.status === "abandonado" && whatsapp && (
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Chamar <MessageCircle className="size-3" />
                    </a>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}
                  >
                    {meta.label}
                  </span>
                  <span className="w-24 text-right font-bold">
                    {formatBRL(Number(pagamento.valor))}
                  </span>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </section>
  );
}
