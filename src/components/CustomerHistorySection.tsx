import { useEffect, useMemo, useState } from "react";
import { CreditCard, History, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  FORMA_PAGAMENTO_META,
  formatBRL,
  STATUS_META,
  type FormaPagamento,
  type PedidoStatus,
} from "@/lib/pedidos-types";

type HistoricoPedido = {
  id: number;
  cliente: string;
  telefone: string | null;
  endereco: string | null;
  itens: unknown;
  total: number;
  status: string;
  forma_pagamento: string;
  pago: boolean;
  created_at: string;
};

type ClienteEncontrado = {
  cliente: string;
  telefone: string;
  telefone_normalizado: string;
  ultimo_pedido_em: string;
};

function resumoItens(itens: unknown) {
  if (!Array.isArray(itens)) return "Itens não informados";
  return itens
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const { nome, quantidade } = item as { nome?: unknown; quantidade?: unknown };
      return typeof nome === "string" ? `${Number(quantidade) || 1}× ${nome}` : null;
    })
    .filter(Boolean)
    .join(", ");
}

export function CustomerHistorySection() {
  const [termoBusca, setTermoBusca] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteEncontrado | null>(null);
  const [historico, setHistorico] = useState<HistoricoPedido[]>([]);
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [ordemClientes, setOrdemClientes] = useState<"recentes" | "antigos">("recentes");

  const clientesOrdenados = useMemo(
    () =>
      [...clientesEncontrados].sort((a, b) => {
        const diferenca =
          new Date(b.ultimo_pedido_em).getTime() - new Date(a.ultimo_pedido_em).getTime();
        return ordemClientes === "recentes" ? diferenca : -diferenca;
      }),
    [clientesEncontrados, ordemClientes],
  );

  const buscarHistorico = async (numero: string) => {
    if (numero.length < 10) return toast.error("Informe um telefone válido com DDD.");

    setBuscando(true);
    const { data, error } = await supabase.rpc("buscar_historico_cliente_dashboard", {
      p_telefone: numero,
      p_limite: 50,
    });
    setBuscando(false);
    setBuscado(true);

    if (error) {
      console.error(error);
      return toast.error("Não foi possível buscar o histórico.");
    }
    setHistorico((data ?? []) as HistoricoPedido[]);
  };

  const buscar = async (event: React.FormEvent) => {
    event.preventDefault();
    const termo = termoBusca.trim();
    if (!termo) return toast.error("Informe o nome ou telefone do cliente.");

    const digitos = termo.replace(/\D/g, "");
    if (/^[\d\s()+.-]+$/.test(termo) && digitos.length >= 10) {
      setClienteSelecionado(null);
      await buscarHistorico(digitos);
      return;
    }

    setHistorico([]);
    setBuscado(false);
    setBuscandoClientes(true);
    const { data, error } = await supabase.rpc("buscar_clientes_por_telefone", {
      p_termo: termo,
      p_limite: null,
    });
    setBuscandoClientes(false);
    if (error) {
      console.error(error);
      return toast.error("Não foi possível buscar clientes.");
    }

    const encontrados = (data ?? []) as ClienteEncontrado[];
    setClientesEncontrados(encontrados);
    if (encontrados.length === 0) return toast.error("Nenhum cliente encontrado com esse nome.");
    if (encontrados.length === 1) {
      await selecionarCliente(encontrados[0]);
      return;
    }
    toast.success(`${encontrados.length} clientes encontrados. Selecione um para ver o histórico.`);
  };

  const selecionarCliente = async (cliente: ClienteEncontrado) => {
    setClienteSelecionado(cliente);
    setTermoBusca(cliente.cliente);
    setClientesEncontrados([]);
    await buscarHistorico(cliente.telefone_normalizado);
  };

  useEffect(() => {
    if (clienteSelecionado) {
      setClientesEncontrados([]);
      return;
    }
    const termo = termoBusca.trim();
    let ativo = true;
    const timer = window.setTimeout(
      async () => {
        setBuscandoClientes(true);
        const { data, error } = await supabase.rpc("buscar_clientes_por_telefone", {
          p_termo: termo,
          p_limite: null,
        });
        if (!ativo) return;
        setBuscandoClientes(false);
        if (error) {
          console.error(error);
          setClientesEncontrados([]);
          return;
        }
        setClientesEncontrados((data ?? []) as ClienteEncontrado[]);
      },
      termo ? 350 : 0,
    );

    return () => {
      ativo = false;
      window.clearTimeout(timer);
    };
  }, [termoBusca, clienteSelecionado]);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Histórico de clientes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Busque pelo nome ou WhatsApp para ver os pedidos e a situação de pagamento.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={buscar} className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input flex-1"
            value={termoBusca}
            onChange={(event) => {
              setTermoBusca(event.target.value.slice(0, 80));
              setClienteSelecionado(null);
              setHistorico([]);
              setBuscado(false);
            }}
            placeholder="Nome do cliente ou WhatsApp"
            type="search"
            autoComplete="off"
          />
          <Button type="submit" className="gap-2" disabled={buscando || buscandoClientes}>
            <Search className="size-4" />
            {buscando ? "Buscando..." : "Buscar histórico"}
          </Button>
        </form>
        {buscandoClientes && (
          <p className="mt-3 text-xs text-muted-foreground">Buscando clientes...</p>
        )}
        {clientesOrdenados.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">
                {termoBusca.trim() ? "Clientes encontrados" : "Todos os clientes"} —
                clique para ver o histórico
              </p>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Ordenar
                <select
                  className="rounded border bg-background px-2 py-1 text-xs text-foreground"
                  value={ordemClientes}
                  onChange={(event) =>
                    setOrdemClientes(event.target.value as "recentes" | "antigos")
                  }
                >
                  <option value="recentes">Mais recente</option>
                  <option value="antigos">Mais antigo</option>
                </select>
              </label>
            </div>
            <div className="divide-y">
              {clientesOrdenados.map((cliente) => (
                <button
                  key={cliente.telefone_normalizado}
                  type="button"
                  onClick={() => selecionarCliente(cliente)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <UserRound className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{cliente.cliente}</span>
                      <span className="block text-xs text-muted-foreground">
                        {cliente.telefone}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(cliente.ultimo_pedido_em).toLocaleDateString("pt-BR")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {buscado && historico.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          Nenhum pedido encontrado para {clienteSelecionado?.cliente ?? termoBusca}.
        </Card>
      )}

      {historico.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {historico.length}{" "}
            {historico.length === 1 ? "pedido encontrado" : "pedidos encontrados"}
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {historico.map((pedido) => (
              <Card key={pedido.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{pedido.cliente}</p>
                    <p className="text-xs text-muted-foreground">Pedido #{pedido.id}</p>
                  </div>
                  <History className="size-5 text-primary" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const status = STATUS_META[pedido.status as PedidoStatus];
                    const pagamento = FORMA_PAGAMENTO_META[pedido.forma_pagamento as FormaPagamento];
                    return (
                      <>
                        <span className={`rounded-full border px-2 py-1 text-[11px] font-medium ${status?.className ?? "bg-muted text-foreground border-border"}`}>
                          {status?.label ?? pedido.status}
                        </span>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${pedido.pago ? "bg-success/10 text-success" : "bg-warning/15 text-warning-foreground"}`}>
                          {pedido.pago ? "Pagamento pago" : "Pagamento pendente"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                          <CreditCard className="size-3" /> {pagamento?.label ?? pedido.forma_pagamento}
                        </span>
                      </>
                    );
                  })()}
                </div>
                <p className="text-sm text-muted-foreground">{resumoItens(pedido.itens)}</p>
                {pedido.endereco && (
                  <p className="text-xs text-muted-foreground">{pedido.endereco}</p>
                )}
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    {new Date(pedido.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  <span className="font-bold text-primary">{formatBRL(Number(pedido.total))}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
