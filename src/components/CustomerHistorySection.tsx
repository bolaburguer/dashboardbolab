import { useEffect, useState } from "react";
import { History, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/pedidos-types";

type HistoricoPedido = {
  id: number;
  cliente: string;
  telefone: string | null;
  endereco: string | null;
  itens: unknown;
  total: number;
  status: string;
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
  const [telefone, setTelefone] = useState("");
  const [historico, setHistorico] = useState<HistoricoPedido[]>([]);
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [buscado, setBuscado] = useState(false);

  const buscarHistorico = async (numero: string) => {
    if (numero.length < 10) return toast.error("Informe um telefone válido com DDD.");

    setBuscando(true);
    const { data, error } = await supabase.rpc("buscar_historico_cliente", {
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
    await buscarHistorico(telefone.replace(/\D/g, ""));
  };

  const selecionarCliente = async (cliente: ClienteEncontrado) => {
    setTelefone(cliente.telefone);
    setClientesEncontrados([]);
    await buscarHistorico(cliente.telefone_normalizado);
  };

  useEffect(() => {
    const termo = telefone.replace(/\D/g, "");
    if (termo.length < 3) {
      setClientesEncontrados([]);
      setBuscandoClientes(false);
      return;
    }

    let ativo = true;
    const timer = window.setTimeout(async () => {
      setBuscandoClientes(true);
      const { data, error } = await supabase.rpc("buscar_clientes_por_telefone", {
        p_termo: termo,
        p_limite: 10,
      });
      if (!ativo) return;
      setBuscandoClientes(false);
      if (error) {
        console.error(error);
        setClientesEncontrados([]);
        return;
      }
      setClientesEncontrados((data ?? []) as ClienteEncontrado[]);
    }, 350);

    return () => {
      ativo = false;
      window.clearTimeout(timer);
    };
  }, [telefone]);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Histórico de clientes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Busque pelo WhatsApp para ver todos os pedidos já feitos pelo cliente.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={buscar} className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input flex-1"
            value={telefone}
            onChange={(event) => setTelefone(event.target.value.slice(0, 20))}
            placeholder="Ex.: (35) 99999-9999"
            inputMode="tel"
            autoComplete="tel"
          />
          <Button type="submit" className="gap-2" disabled={buscando}>
            <Search className="size-4" />
            {buscando ? "Buscando..." : "Buscar histórico"}
          </Button>
        </form>
        {buscandoClientes && (
          <p className="mt-3 text-xs text-muted-foreground">Buscando clientes...</p>
        )}
        {clientesEncontrados.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg border">
            <p className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              Clientes encontrados — clique para ver o histórico
            </p>
            <div className="divide-y">
              {clientesEncontrados.map((cliente) => (
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
          Nenhum pedido encontrado para este telefone.
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
