import { useState, useEffect } from "react";
import { Plus, Trash2, Truck, Store, Wallet, CreditCard, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Pedido, PedidoItem, TipoEntrega, FormaPagamento } from "@/lib/pedidos-types";
import { formatBRL } from "@/lib/pedidos-types";
import { CARDAPIO } from "@/lib/cardapio";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Pedido | null;
  onSubmit: (data: {
    cliente: string;
    telefone: string;
    endereco: string;
    itens: PedidoItem[];
    total: number;
    tipo_entrega: TipoEntrega;
    taxa_entrega: number;
    forma_pagamento: FormaPagamento;
    pago: boolean;
  }) => Promise<void> | void;
}

const emptyItem = (): PedidoItem => ({ nome: "", quantidade: 1, preco: 0, observacao: "" });

const FORMAS: { value: FormaPagamento; label: string; icon: typeof Wallet }[] = [
  { value: "pix", label: "PIX", icon: QrCode },
  { value: "dinheiro", label: "Dinheiro", icon: Wallet },
  { value: "cartao", label: "Cartão", icon: CreditCard },
];

const LOCALIDADES_ENTREGA = [
  { label: "São José do Alegre", value: "sao-jose-do-alegre", fee: 5 },
  { label: "Foros", value: "foros", fee: 7 },
  { label: "Pavão", value: "pavao", fee: 7 },
  { label: "Machado", value: "machado", fee: 15 },
  { label: "Fundão", value: "fundao", fee: 15 },
  { label: "Ribeirão", value: "ribeirao", fee: 15 },
  { label: "Pinhal", value: "pinhal", fee: 15 },
  { label: "Boqueirão", value: "boqueirao", fee: 30 },
  { label: "Pinhalzinho", value: "pinhalzinho", fee: 12 },
  { label: "Mariano 1 ou 2", value: "mariano-1-ou-2", fee: 13 },
  { label: "Santa Bárbara do Sapucaí", value: "santa-barbara-do-sapucai", fee: 15 },
] as const;

type LocalidadeEntrega = (typeof LOCALIDADES_ENTREGA)[number]["value"] | "";

export function PedidoForm({ open, onOpenChange, initial, onSubmit }: Props) {
  const [cliente, setCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [itens, setItens] = useState<PedidoItem[]>([emptyItem()]);
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>("retirada");
  const [localidadeEntrega, setLocalidadeEntrega] = useState<LocalidadeEntrega>("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [pago, setPago] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCliente(initial?.cliente ?? "");
      setTelefone(initial?.telefone ?? "");
      setEndereco(initial?.endereco ?? "");
      setItens(initial?.itens?.length ? initial.itens : [emptyItem()]);
      setTipoEntrega(initial?.tipo_entrega ?? "retirada");
      setLocalidadeEntrega(
        initial?.tipo_entrega === "entrega"
          ? (LOCALIDADES_ENTREGA.find((localidade) => localidade.fee === initial.taxa_entrega)
              ?.value ?? "")
          : "",
      );
      setFormaPagamento(initial?.forma_pagamento ?? "pix");
      setPago(initial?.pago ?? false);
    }
  }, [open, initial]);

  const subtotal = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const localidadeSelecionada = LOCALIDADES_ENTREGA.find(
    (localidade) => localidade.value === localidadeEntrega,
  );
  const taxa = tipoEntrega === "entrega" ? (localidadeSelecionada?.fee ?? 0) : 0;
  const total = subtotal + taxa;

  const updateItem = (i: number, patch: Partial<PedidoItem>) =>
    setItens((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const handleSubmit = async () => {
    if (!cliente.trim() || itens.length === 0) return;
    setSaving(true);
    try {
      await onSubmit({
        cliente: cliente.trim(),
        telefone: telefone.trim(),
        endereco: endereco.trim(),
        itens: itens
          .filter((i) => i.nome.trim())
          .map((i) => ({
            ...i,
            nome: i.nome.trim(),
            observacao: i.observacao?.trim() || undefined,
          })),
        total,
        tipo_entrega: tipoEntrega,
        taxa_entrega: taxa,
        forma_pagamento: formaPagamento,
        pago,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {initial ? "Editar pedido" : "Novo pedido"}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do cliente, escolha entrega, forma de pagamento e adicione os itens.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="grid gap-2">
            <Label>Cliente *</Label>
            <Input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nome do cliente"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Telefone</Label>
              <Input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="grid gap-2">
              <Label>Endereço</Label>
              <Input
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro"
              />
            </div>
          </div>

          {/* Tipo de entrega */}
          <div className="grid gap-2">
            <Label>Tipo de pedido</Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setTipoEntrega("retirada");
                  setLocalidadeEntrega("");
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-3 transition-colors ${
                  tipoEntrega === "retirada"
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border bg-muted/40 hover:bg-muted/60"
                }`}
              >
                <Store className="size-4" /> Retirada
              </button>
              <button
                type="button"
                onClick={() => setTipoEntrega("entrega")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-3 transition-colors ${
                  tipoEntrega === "entrega"
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border bg-muted/40 hover:bg-muted/60"
                }`}
              >
                <Truck className="size-4" /> Entrega
              </button>
            </div>
          </div>

          {tipoEntrega === "entrega" && (
            <div className="grid gap-2">
              <Label>Localidade de entrega *</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {LOCALIDADES_ENTREGA.map((localidade) => {
                  const selecionada = localidadeEntrega === localidade.value;
                  return (
                    <button
                      key={localidade.value}
                      type="button"
                      onClick={() => setLocalidadeEntrega(localidade.value)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        selecionada
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "border-border bg-muted/40 hover:bg-muted/60"
                      }`}
                    >
                      <span>{localidade.label}</span>
                      <span className="tabular-nums">{formatBRL(localidade.fee)}</span>
                    </button>
                  );
                })}
              </div>
              {!localidadeSelecionada && (
                <p className="text-xs text-muted-foreground">
                  Escolha a localidade para calcular a taxa de entrega.
                </p>
              )}
            </div>
          )}

          {/* Forma de pagamento */}
          <div className="grid gap-2">
            <Label>Forma de pagamento</Label>
            <div className="grid grid-cols-3 gap-3">
              {FORMAS.map((f) => {
                const Icon = f.icon;
                const active = formaPagamento === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFormaPagamento(f.value)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-muted/40 hover:bg-muted/60"
                    }`}
                  >
                    <Icon className="size-4" /> {f.label}
                  </button>
                );
              })}
            </div>
            <label className="mt-1 flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pago}
                onChange={(e) => setPago(e.target.checked)}
                className="size-4 accent-success"
              />
              <span>Já está pago</span>
            </label>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Itens do pedido</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setItens((a) => [...a, emptyItem()])}
              >
                <Plus className="size-4 mr-1" /> Item
              </Button>
            </div>

            <div className="space-y-2">
              {itens.map((it, i) => (
                <div key={i} className="grid gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Selecionar do cardápio</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      aria-label={`Selecionar item ${i + 1} do cardápio`}
                      value={CARDAPIO.find((item) => item.nome === it.nome)?.nome ?? ""}
                      onChange={(e) => {
                        const item = CARDAPIO.find((option) => option.nome === e.target.value);
                        if (item) updateItem(i, { nome: item.nome, preco: item.preco });
                      }}
                    >
                      <option value="">Escolha um item ou preencha abaixo</option>
                      {CARDAPIO.map((item) => (
                        <option key={item.nome} value={item.nome}>
                          {item.nome} — {formatBRL(item.preco)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-[1fr_80px_110px_auto] gap-2 items-end">
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">Nome</Label>
                      <Input
                        value={it.nome}
                        onChange={(e) => updateItem(i, { nome: e.target.value })}
                        placeholder="Bola Classic"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">Qtd</Label>
                      <Input
                        type="number"
                        min={1}
                        value={it.quantidade}
                        onChange={(e) =>
                          updateItem(i, { quantidade: Math.max(1, Number(e.target.value) || 1) })
                        }
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">Preço un.</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={it.preco}
                        onChange={(e) => updateItem(i, { preco: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setItens((a) => a.filter((_, idx) => idx !== i))}
                      disabled={itens.length === 1}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Observação</Label>
                    <Textarea
                      value={it.observacao ?? ""}
                      onChange={(e) => updateItem(i, { observacao: e.target.value })}
                      placeholder="Ex: sem cebola, ponto da carne, molho separado"
                      className="min-h-16 resize-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo do total com taxa */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatBRL(subtotal)}</span>
            </div>
            {tipoEntrega === "entrega" && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Taxa de entrega</span>
                <span className="tabular-nums">{formatBRL(taxa)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-primary/10 pt-2">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-2xl font-bold text-primary">{formatBRL(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              saving || !cliente.trim() || (tipoEntrega === "entrega" && !localidadeSelecionada)
            }
          >
            {saving ? "Salvando..." : initial ? "Salvar alterações" : "Criar pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
