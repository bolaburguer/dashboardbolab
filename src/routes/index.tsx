import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, TrendingUp, ClipboardList, ChefHat, Wallet, Flame, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Pedido, PedidoStatus, PedidoItem, TipoEntrega, FormaPagamento } from "@/lib/pedidos-types";
import { formatBRL, STATUS_META } from "@/lib/pedidos-types";
import { PedidoCard } from "@/components/pedidos/PedidoCard";
import { PedidoForm } from "@/components/pedidos/PedidoForm";

export const Route = createFileRoute("/")({
  // Dashboard usa Supabase e Radix no browser — SSR causava erro de hidratação no Netlify.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — Hamburgueria" },
      { name: "description", content: "Painel de pedidos da hamburgueria — registre, acompanhe e gerencie pedidos em tempo real." },
    ],
  }),
  component: Dashboard,
});

type Filter = "todos" | PedidoStatus;

function Dashboard() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Pedido | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) { toast.error("Erro ao carregar pedidos"); return; }
      setPedidos((data ?? []) as unknown as Pedido[]);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel("pedidos-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        (payload) => {
          setPedidos((prev) => {
            if (payload.eventType === "INSERT") {
              const novo = payload.new as unknown as Pedido;
              if (prev.some((p) => p.id === novo.id)) return prev;
              return [novo, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const atualizado = payload.new as unknown as Pedido;
              return prev.map((p) => (p.id === atualizado.id ? atualizado : p));
            }
            if (payload.eventType === "DELETE") {
              const removido = payload.old as unknown as { id: number };
              return prev.filter((p) => p.id !== removido.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const pedidosHoje = pedidos.filter((p) => new Date(p.created_at) >= hoje);
  const ativosHoje = pedidosHoje.filter((p) => p.status !== "cancelado");

  const recebidoHoje = ativosHoje
    .filter((p) => p.pago)
    .reduce((s, p) => s + Number(p.total), 0);
  const aReceberHoje = ativosHoje
    .filter((p) => !p.pago)
    .reduce((s, p) => s + Number(p.total), 0);
  const faturadoHoje = ativosHoje.reduce((s, p) => s + Number(p.total), 0);
  const emPreparacao = pedidos.filter((p) => p.status === "em-preparacao").length;
  const pendentes = pedidos.filter((p) => p.status === "pendente").length;

  const filtered = useMemo(
    () => filter === "todos" ? pedidos : pedidos.filter((p) => p.status === filter),
    [pedidos, filter],
  );

  // Optimistic update helper
  const patchLocal = (id: number, patch: Partial<Pedido>) =>
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const handleStatus = async (id: number, status: PedidoStatus) => {
    const prev = pedidos.find((p) => p.id === id);
    patchLocal(id, { status });
    const { error } = await supabase.from("pedidos").update({ status }).eq("id", id);
    if (error) {
      if (prev) patchLocal(id, { status: prev.status });
      toast.error("Não foi possível atualizar");
    } else {
      toast.success(`Pedido #${id} → ${STATUS_META[status].label}`);
    }
  };

  const handleTogglePago = async (id: number, pago: boolean) => {
    patchLocal(id, { pago });
    const { error } = await supabase.from("pedidos").update({ pago }).eq("id", id);
    if (error) {
      patchLocal(id, { pago: !pago });
      toast.error("Não foi possível atualizar pagamento");
    } else {
      toast.success(pago ? `Pedido #${id} marcado como pago` : `Pedido #${id} marcado como pendente`);
    }
  };

  const handleSubmit = async (data: {
    cliente: string; telefone: string; endereco: string; itens: PedidoItem[]; total: number; tipo_entrega: TipoEntrega; taxa_entrega: number; forma_pagamento: FormaPagamento; pago: boolean;
  }) => {
    const payload = {
      cliente: data.cliente,
      telefone: data.telefone || null,
      endereco: data.endereco || null,
      itens: data.itens as unknown as never,
      total: data.total,
      tipo_entrega: data.tipo_entrega,
      taxa_entrega: data.taxa_entrega,
      forma_pagamento: data.forma_pagamento,
      pago: data.pago,
    };

    if (editing) {
      const { error } = await supabase.from("pedidos").update(payload).eq("id", editing.id);
      if (error) toast.error("Erro ao salvar"); else toast.success("Pedido atualizado");
    } else {
      const { error } = await supabase.from("pedidos").insert({ ...payload, status: "pendente" });
      if (error) toast.error("Erro ao criar"); else toast.success("Pedido criado");
    }
    setEditing(null);
  };

  const stats = [
    { label: "Faturado hoje", value: formatBRL(faturadoHoje), icon: TrendingUp, accent: "text-info", bg: "bg-info/10" },
    { label: "Recebido hoje", value: formatBRL(recebidoHoje), icon: Wallet, accent: "text-success", bg: "bg-success/10" },
    { label: "A receber", value: formatBRL(aReceberHoje), icon: CircleDashed, accent: "text-warning", bg: "bg-warning/15" },
    { label: "Em preparação", value: emPreparacao, icon: ChefHat, accent: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="min-h-screen bg-[var(--gradient-surface)]">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
              <Flame className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Burger Dashboard</h1>
              <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </p>
            </div>
          </div>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} size="lg" className="shadow-[var(--shadow-glow)]">
            <Plus className="size-4" /> Novo pedido
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="p-5 border-border/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  <p className="text-3xl font-bold mt-2 tabular-nums">{s.value}</p>
                </div>
                <div className={`size-10 rounded-xl grid place-items-center ${s.bg}`}>
                  <s.icon className={`size-5 ${s.accent}`} />
                </div>
              </div>
            </Card>
          ))}
        </section>

        {/* Filters */}
        <section className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">Pedidos</h2>
            <p className="text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "pedido" : "pedidos"}
              {pendentes > 0 && filter === "todos" && (
                <span className="ml-2 inline-flex items-center gap-1 text-warning font-medium">
                  • {pendentes} aguardando
                </span>
              )}
            </p>
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="pendente">Pendentes</TabsTrigger>
              <TabsTrigger value="em-preparacao">Preparo</TabsTrigger>
              <TabsTrigger value="entregue">Entregues</TabsTrigger>
              <TabsTrigger value="cancelado">Cancelados</TabsTrigger>
            </TabsList>
          </Tabs>
        </section>

        {/* Lista */}
        {loading ? (
          <p className="text-center text-muted-foreground py-20">Carregando...</p>
        ) : filtered.length === 0 ? (
          <Card className="p-16 text-center border-dashed">
            <div className="size-14 rounded-2xl bg-muted mx-auto grid place-items-center mb-4">
              <ClipboardList className="size-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">Nenhum pedido por aqui</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Crie o primeiro pedido para começar a registrar suas vendas.
            </p>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="size-4" /> Novo pedido
            </Button>
          </Card>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <PedidoCard
                key={p.id}
                pedido={p}
                onStatusChange={handleStatus}
                onTogglePago={handleTogglePago}
                onEdit={(ped) => { setEditing(ped); setFormOpen(true); }}
              />
            ))}
          </section>
        )}
      </main>

      <PedidoForm
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        initial={editing}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
