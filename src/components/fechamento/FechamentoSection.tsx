import { useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarRange,
  Download,
  FileText,
  History,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { downloadFechamentoPdf, downloadPeriodoPdf } from "@/lib/fechamento-pdf";
import {
  formatDateBR,
  fechamentosNoPeriodo,
  intervaloMes,
  intervaloSemana,
  resumoMensal,
  resumoSemanal,
  toDateKey,
} from "@/lib/fechamento-stats";
import {
  buildFechamentoFromPedidos,
  rowToFechamento,
  type FechamentoDiario,
} from "@/lib/fechamento-types";
import { formatBRL } from "@/lib/pedidos-types";
import type { Pedido } from "@/lib/pedidos-types";

interface Props {
  pedidosHoje: Pedido[];
  fechamentos: FechamentoDiario[];
  diaJaFechado: boolean;
  onFechamentoSalvo: () => void;
}

export function FechamentoSection({
  pedidosHoje,
  fechamentos,
  diaJaFechado,
  onFechamentoSalvo,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const hojeKey = toDateKey();
  const semana = useMemo(() => resumoSemanal(fechamentos), [fechamentos]);
  const mes = useMemo(() => resumoMensal(fechamentos), [fechamentos]);

  const fechamentosSemana = useMemo(() => {
    const { inicio, fim } = intervaloSemana();
    return fechamentosNoPeriodo(fechamentos, inicio, fim);
  }, [fechamentos]);

  const fechamentosMes = useMemo(() => {
    const { inicio, fim } = intervaloMes();
    return fechamentosNoPeriodo(fechamentos, inicio, fim);
  }, [fechamentos]);

  const handleEncerrarDia = async () => {
    setSalvando(true);
    try {
      const payload = buildFechamentoFromPedidos(hojeKey, pedidosHoje);
      const { data, error } = await supabase
        .from("fechamentos_diarios")
        .insert({
          ...payload,
          detalhes: payload.detalhes as unknown as never,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Este dia já foi encerrado.");
        } else {
          toast.error("Erro ao salvar fechamento. Rode a migration no Supabase.");
          console.error(error);
        }
        return;
      }

      const fechamento = rowToFechamento(data);
      downloadFechamentoPdf(fechamento);
      toast.success("Dia encerrado! PDF baixado e registro salvo.");
      onFechamentoSalvo();
    } finally {
      setSalvando(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <CalendarCheck className="size-6" />
              Fechamento e relatórios
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Encerre o dia para arquivar o faturamento e iniciar o próximo turno.
            </p>
          </div>
          <Button
            size="lg"
            variant={diaJaFechado ? "outline" : "default"}
            disabled={diaJaFechado}
            onClick={() => setConfirmOpen(true)}
            className="gap-2"
          >
            {diaJaFechado ? (
              <>
                <Lock className="size-4" /> Dia encerrado
              </>
            ) : (
              <>
                <CalendarCheck className="size-4" /> Encerrar dia
              </>
            )}
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="p-5 border-border/60">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <CalendarRange className="size-3.5" /> Semanal
                </p>
                <p className="text-2xl font-bold mt-2 tabular-nums">{formatBRL(semana.faturado)}</p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{semana.label}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Recebido {formatBRL(semana.recebido)} · {semana.total_pedidos} pedidos ·{" "}
                  {semana.dias_registrados} dia(s) fechado(s)
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={fechamentosSemana.length === 0}
                onClick={() =>
                  downloadPeriodoPdf(`Relatório semanal — ${semana.label}`, semana, fechamentosSemana)
                }
              >
                <Download className="size-4" /> PDF
              </Button>
            </div>
          </Card>

          <Card className="p-5 border-border/60">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <CalendarRange className="size-3.5" /> Mensal
                </p>
                <p className="text-2xl font-bold mt-2 tabular-nums">{formatBRL(mes.faturado)}</p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{mes.label}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Recebido {formatBRL(mes.recebido)} · {mes.total_pedidos} pedidos ·{" "}
                  {mes.dias_registrados} dia(s) fechado(s)
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={fechamentosMes.length === 0}
                onClick={() =>
                  downloadPeriodoPdf(`Relatório mensal — ${mes.label}`, mes, fechamentosMes)
                }
              >
                <Download className="size-4" /> PDF
              </Button>
            </div>
          </Card>
        </div>

        <Card className="p-5 border-border/60">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <History className="size-4" /> Histórico de fechamentos
          </h3>
          {fechamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum dia encerrado ainda. Use &quot;Encerrar dia&quot; ao final do expediente.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Data</th>
                    <th className="pb-2 pr-4 font-medium">Faturado</th>
                    <th className="pb-2 pr-4 font-medium">Recebido</th>
                    <th className="pb-2 pr-4 font-medium">Pedidos</th>
                    <th className="pb-2 font-medium">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {fechamentos.map((f) => (
                    <tr key={f.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 pr-4">{formatDateBR(f.data)}</td>
                      <td className="py-3 pr-4 tabular-nums">{formatBRL(f.faturado)}</td>
                      <td className="py-3 pr-4 tabular-nums">{formatBRL(f.recebido)}</td>
                      <td className="py-3 pr-4">{f.total_pedidos}</td>
                      <td className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => downloadFechamentoPdf(f)}>
                          <FileText className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar o dia?</DialogTitle>
            <DialogDescription>
              Será gerado o registro de <strong>{formatDateBR(hojeKey)}</strong> com{" "}
              {pedidosHoje.length} pedido(s), o PDF será baixado e o histórico atualizado. Novos
              pedidos amanhã começam em uma lista limpa.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
            <p>
              Faturado: <strong>{formatBRL(buildFechamentoFromPedidos(hojeKey, pedidosHoje).faturado)}</strong>
            </p>
            <p>Pedidos: {pedidosHoje.length}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEncerrarDia} disabled={salvando}>
              {salvando ? "Salvando…" : "Confirmar e baixar PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
