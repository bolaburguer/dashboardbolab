import { useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarRange,
  Download,
  FileText,
  History,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FechamentoDetalhes } from "@/components/fechamento/FechamentoDetalhes";
import {
  downloadFechamentoExcel,
  downloadPeriodoExcel,
} from "@/lib/fechamento-export";
import { reportSummary } from "@/lib/fechamento-report";
import type { CaixaFechamento } from "@/lib/fechamento-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  downloadFechamentoPdf,
  downloadPeriodoPdf,
} from "@/lib/fechamento-pdf";
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
import { formatTurnoHorario, type Turno } from "@/lib/turno-types";

interface Props {
  pedidosTurno: Pedido[];
  fechamentos: FechamentoDiario[];
  turnoAtivo: Turno | null;
  onFechamentoSalvo: () => void;
  onIniciarDia: () => Promise<void>;
  iniciandoDia: boolean;
}

export function FechamentoSection({
  pedidosTurno,
  fechamentos,
  turnoAtivo,
  onFechamentoSalvo,
  onIniciarDia,
  iniciandoDia,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [selecionado, setSelecionado] = useState<FechamentoDiario | null>(null);
  const [caixaInput, setCaixaInput] = useState({
    saldo_inicial: "",
    saidas: "",
    dinheiro_contado: "",
    responsavel: "",
    observacoes: "",
  });
  const [exportando, setExportando] = useState(false);
  const caixa: CaixaFechamento = {
    saldo_inicial:
      caixaInput.saldo_inicial === "" ? null : Number(caixaInput.saldo_inicial),
    saidas: caixaInput.saidas === "" ? null : Number(caixaInput.saidas),
    dinheiro_contado:
      caixaInput.dinheiro_contado === ""
        ? null
        : Number(caixaInput.dinheiro_contado),
    responsavel: caixaInput.responsavel.trim(),
    observacoes: caixaInput.observacoes.trim(),
  };
  const previa = {
    ...buildFechamentoFromPedidos(toDateKey(), pedidosTurno, undefined, caixa),
    id: 0,
    created_at: new Date().toISOString(),
  };
  const resumoTurno = reportSummary(previa);
  const excel = async (f: FechamentoDiario) => {
    setExportando(true);
    try {
      await downloadFechamentoExcel(f);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o Excel. Tente novamente.");
    } finally {
      setExportando(false);
    }
  };
  const excelPeriodo = async (titulo: string, lista: FechamentoDiario[]) => {
    setExportando(true);
    try {
      await downloadPeriodoExcel(titulo, lista);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o Excel.");
    } finally {
      setExportando(false);
    }
  };

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
    if (!turnoAtivo) return;
    setSalvando(true);
    try {
      if (
        !caixa.responsavel ||
        [caixa.saldo_inicial, caixa.saidas, caixa.dinheiro_contado].some(
          (n) => n != null && (!Number.isFinite(n) || n < 0),
        )
      ) {
        toast.error("Informe o responsável e valores de caixa válidos.");
        return;
      }
      const { data, error } = await supabase.rpc(
        "encerrar_turno_com_relatorio",
        {
          p_turno_id: turnoAtivo.id,
          p_caixa:
            caixa as unknown as import("@/integrations/supabase/types").Json,
        },
      );

      if (error) {
        toast.error("Não foi possível encerrar: " + error.message);
        console.error(error);
        return;
      }

      const fechamento = rowToFechamento(
        data as unknown as Parameters<typeof rowToFechamento>[0],
      );
      setSelecionado(fechamento);
      toast.success(
        "Dia encerrado. Relatório disponível para baixar em PDF ou Excel.",
      );
      onFechamentoSalvo();
      setCaixaInput({
        saldo_inicial: "",
        saidas: "",
        dinheiro_contado: "",
        responsavel: "",
        observacoes: "",
      });
    } catch (e) {
      console.error(e);
      toast.error(
        "Falha ao encerrar o turno. Confira a conexão e tente novamente.",
      );
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
              {turnoAtivo
                ? `Turno aberto · ${formatTurnoHorario(turnoAtivo)}`
                : "Nenhum turno aberto — inicie o dia para registrar pedidos."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!turnoAtivo ? (
              <Button
                size="lg"
                className="gap-2"
                onClick={onIniciarDia}
                disabled={iniciandoDia}
              >
                <PlayCircle className="size-4" />
                {iniciandoDia ? "Abrindo…" : "Iniciar dia"}
              </Button>
            ) : (
              <Button
                size="lg"
                className="gap-2"
                onClick={() => setConfirmOpen(true)}
              >
                <CalendarCheck className="size-4" /> Encerrar dia
              </Button>
            )}
          </div>
        </div>

        {turnoAtivo && (
          <Card className="p-5 space-y-3">
            <h3 className="font-semibold">Resumo do turno atual</h3>
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <p>
                Vendido <strong>{formatBRL(resumoTurno.faturado)}</strong>
              </p>
              <p>
                Pago no sistema{" "}
                <strong>{formatBRL(resumoTurno.recebido)}</strong>
              </p>
              <p className="text-orange-600">
                Pendente <strong>{formatBRL(resumoTurno.pendente)}</strong>
              </p>
              <p>Ticket médio {formatBRL(resumoTurno.ticket)}</p>
              <p>{resumoTurno.pendentes.length} pagamento(s) pendente(s)</p>
              <p>Pago {(resumoTurno.percentualPago * 100).toFixed(1)}%</p>
            </div>
            <Button variant="outline" onClick={() => setSelecionado(previa)}>
              Visualizar relatório do turno
            </Button>
          </Card>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="p-5 border-border/60">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <CalendarRange className="size-3.5" /> Semanal
                </p>
                <p className="text-2xl font-bold mt-2 tabular-nums">
                  {formatBRL(semana.faturado)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">
                  {semana.label}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Recebido {formatBRL(semana.recebido)} · {semana.total_pedidos}{" "}
                  pedidos · {semana.dias_registrados} fechamento(s)
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={fechamentosSemana.length === 0}
                onClick={() =>
                  downloadPeriodoPdf(
                    `Relatório semanal — ${semana.label}`,
                    semana,
                    fechamentosSemana,
                  )
                }
              >
                <Download className="size-4" /> PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={exportando || !fechamentosSemana.length}
                onClick={() =>
                  void excelPeriodo(
                    `Relatório semanal - ${semana.label}`,
                    fechamentosSemana,
                  )
                }
              >
                Excel
              </Button>
            </div>
          </Card>

          <Card className="p-5 border-border/60">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <CalendarRange className="size-3.5" /> Mensal
                </p>
                <p className="text-2xl font-bold mt-2 tabular-nums">
                  {formatBRL(mes.faturado)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">
                  {mes.label}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Recebido {formatBRL(mes.recebido)} · {mes.total_pedidos}{" "}
                  pedidos · {mes.dias_registrados} fechamento(s)
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={fechamentosMes.length === 0}
                onClick={() =>
                  downloadPeriodoPdf(
                    `Relatório mensal — ${mes.label}`,
                    mes,
                    fechamentosMes,
                  )
                }
              >
                <Download className="size-4" /> PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={exportando || !fechamentosMes.length}
                onClick={() =>
                  void excelPeriodo(
                    `Relatório mensal - ${mes.label}`,
                    fechamentosMes,
                  )
                }
              >
                Excel
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
              Nenhum fechamento ainda. Inicie o dia, registre pedidos e encerre
              ao final.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Data</th>
                    <th className="pb-2 pr-4 font-medium">Turno</th>
                    <th className="pb-2 pr-4 font-medium">Faturado</th>
                    <th className="pb-2 pr-4 font-medium">Recebido</th>
                    <th className="pb-2 pr-4 font-medium">Pedidos</th>
                    <th className="pb-2 font-medium">Relatório</th>
                  </tr>
                </thead>
                <tbody>
                  {fechamentos.map((f) => (
                    <tr
                      key={f.id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-3 pr-4">{formatDateBR(f.data)}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {f.iniciado_em && f.encerrado_em
                          ? `${new Date(f.iniciado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} – ${new Date(f.encerrado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 tabular-nums">
                        {formatBRL(f.faturado)}
                      </td>
                      <td className="py-3 pr-4 tabular-nums">
                        {formatBRL(f.recebido)}
                      </td>
                      <td className="py-3 pr-4">{f.total_pedidos}</td>
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelecionado(f)}
                        >
                          Ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFechamentoPdf(f)}
                        >
                          <FileText className="size-4" /> PDF
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={exportando}
                          onClick={() => void excel(f)}
                        >
                          Excel
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
              Será gerado o registro de <strong>{formatDateBR(hojeKey)}</strong>{" "}
              com {pedidosTurno.length} pedido(s) deste turno. O relatório
              ficará disponível em PDF e Excel. Depois, use{" "}
              <strong>Iniciar dia</strong> quando quiser reabrir.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
            <p>
              Faturado:{" "}
              <strong>
                {formatBRL(
                  buildFechamentoFromPedidos(hojeKey, pedidosTurno).faturado,
                )}
              </strong>
            </p>
            <p>Pedidos: {pedidosTurno.length}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["saldo_inicial", "Saldo inicial"],
                ["saidas", "Saídas e sangrias"],
                ["dinheiro_contado", "Dinheiro contado"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={key}>{label} (R$)</Label>
                <Input
                  id={key}
                  type="number"
                  min="0"
                  step="0.01"
                  value={caixaInput[key]}
                  placeholder="Não informado"
                  onChange={(e) =>
                    setCaixaInput((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
            <div>
              <Label htmlFor="responsavel">Responsável *</Label>
              <Input
                id="responsavel"
                value={caixaInput.responsavel}
                onChange={(e) =>
                  setCaixaInput((v) => ({ ...v, responsavel: e.target.value }))
                }
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="obs-caixa">
                Observações / descrição das saídas
              </Label>
              <Input
                id="obs-caixa"
                value={caixaInput.observacoes}
                onChange={(e) =>
                  setCaixaInput((v) => ({ ...v, observacoes: e.target.value }))
                }
              />
            </div>
            <p className="col-span-2 text-sm">
              Entradas em dinheiro: {formatBRL(resumoTurno.entrada)} · Esperado:{" "}
              {resumoTurno.esperado == null
                ? "não informado"
                : formatBRL(resumoTurno.esperado)}{" "}
              · Diferença:{" "}
              {resumoTurno.diferenca == null
                ? "não informada"
                : formatBRL(resumoTurno.diferenca)}
            </p>
            <p className="col-span-2 text-xs text-muted-foreground">
              Use zero quando não houver saldo ou saídas. Campos vazios deixam a
              conferência incompleta.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEncerrarDia} disabled={salvando}>
              {salvando ? "Salvando…" : "Confirmar fechamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selecionado}
        onOpenChange={(open) => {
          if (!open) setSelecionado(null);
        }}
      >
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Relatório de fechamento {selecionado?.data}
            </DialogTitle>
            <DialogDescription>
              {selecionado?.id === 0
                ? "Prévia do turno em andamento."
                : "Dados preservados no encerramento do turno."}
            </DialogDescription>
          </DialogHeader>
          {selecionado && (
            <>
              <div className="flex gap-2">
                <Button onClick={() => downloadFechamentoPdf(selecionado)}>
                  Baixar PDF
                </Button>
                <Button
                  disabled={exportando}
                  onClick={() => void excel(selecionado)}
                >
                  {exportando ? "Gerando…" : "Baixar Excel"}
                </Button>
              </div>
              <FechamentoDetalhes fechamento={selecionado} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
