import { useState } from "react";
import { History, Search } from "lucide-react";
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
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);

  const buscar = async (event: React.FormEvent) => {
    event.preventDefault();
    const numero = telefone.replace(/\D/g, "");
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
