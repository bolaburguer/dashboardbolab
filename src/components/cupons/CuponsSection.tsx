import { useCallback, useEffect, useState } from "react";
import { Percent, Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type TipoDesconto = "percentual" | "frete_gratis";
type Cupom = {
  id: number;
  codigo: string;
  descricao: string;
  tipo_desconto: TipoDesconto;
  valor_desconto: number;
  minimo_itens: number;
  ativo: boolean;
};
const PERCENTUAIS = [5, 7, 10, 15];

export function CuponsSection() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<TipoDesconto>("percentual");
  const [percentual, setPercentual] = useState(5);
  const [minimoItens, setMinimoItens] = useState(0);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("cupons")
      .select("id, codigo, descricao, tipo_desconto, valor_desconto, minimo_itens, ativo")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Não foi possível carregar os cupons.");
    } else setCupons((data ?? []) as Cupom[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const criarCupom = async (event: React.FormEvent) => {
    event.preventDefault();
    const codigoNormalizado = codigo.trim().toUpperCase().replace(/\s+/g, "");
    const descricaoNormalizada = descricao.trim();
    if (!codigoNormalizado || !descricaoNormalizada)
      return toast.error("Informe o código e o nome do cupom.");
    setSalvando(true);
    const { data, error } = await supabase
      .from("cupons")
      .insert({
        codigo: codigoNormalizado,
        descricao: descricaoNormalizada,
        tipo_desconto: tipo,
        valor_desconto: tipo === "percentual" ? percentual : 0,
        minimo_itens: minimoItens,
        ativo: false,
      })
      .select("id, codigo, descricao, tipo_desconto, valor_desconto, minimo_itens, ativo")
      .single();
    setSalvando(false);
    if (error) {
      console.error(error);
      return toast.error(
        error.code === "23505" ? "Esse código já existe." : "Não foi possível criar o cupom.",
      );
    }
    setCupons((atual) => [data as Cupom, ...atual]);
    setCodigo("");
    setDescricao("");
    setTipo("percentual");
    setPercentual(5);
    setMinimoItens(0);
    toast.success("Cupom criado. Ative-o quando estiver pronto.");
  };

  const alternarAtivo = async (cupom: Cupom, ativo: boolean) => {
    setCupons((atual) => atual.map((item) => (item.id === cupom.id ? { ...item, ativo } : item)));
    const { error } = await supabase.from("cupons").update({ ativo }).eq("id", cupom.id);
    if (error) {
      setCupons((atual) =>
        atual.map((item) => (item.id === cupom.id ? { ...item, ativo: cupom.ativo } : item)),
      );
      return toast.error("Não foi possível atualizar o cupom.");
    }
    toast.success(ativo ? "Cupom ativado no site." : "Cupom desativado.");
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Cupons de desconto</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Crie o código e o nome que quiser. O cliente só consegue usar cupons ativos.
        </p>
      </div>
      <Card className="p-6">
        <form onSubmit={criarCupom} className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Código do cupom
            <input
              className="input"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="EX: BOLA10"
              maxLength={30}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Nome exibido
            <input
              className="input"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: 10% de desconto de boas-vindas"
              maxLength={80}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Benefício
            <select
              className="input"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoDesconto)}
            >
              <option value="percentual">Desconto percentual</option>
              <option value="frete_gratis">Frete grátis</option>
            </select>
          </label>
          {tipo === "percentual" ? (
            <label className="grid gap-1.5 text-sm font-medium">
              Desconto
              <select
                className="input"
                value={percentual}
                onChange={(e) => setPercentual(Number(e.target.value))}
              >
                {PERCENTUAIS.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}% de desconto
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="flex items-end text-sm text-muted-foreground">
              O valor da taxa de entrega será zerado.
            </div>
          )}
          <label className="grid gap-1.5 text-sm font-medium">
            Mínimo de lanches
            <select
              className="input"
              value={minimoItens}
              onChange={(e) => setMinimoItens(Number(e.target.value))}
            >
              <option value={0}>Sem mínimo</option>
              <option value={2}>A partir de 2 lanches</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit" disabled={salvando} className="gap-2 w-full sm:w-auto">
              <Plus className="size-4" />
              {salvando ? "Criando..." : "Criar cupom"}
            </Button>
          </div>
        </form>
      </Card>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando cupons...</p>
      ) : cupons.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Nenhum cupom criado ainda.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cupons.map((cupom) => (
            <Card key={cupom.id} className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold truncate">{cupom.descricao}</p>
                  <p className="font-mono text-sm text-primary mt-1">{cupom.codigo}</p>
                </div>
                {cupom.tipo_desconto === "frete_gratis" ? (
                  <Truck className="size-5 text-primary" />
                ) : (
                  <Percent className="size-5 text-primary" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {cupom.tipo_desconto === "frete_gratis"
                  ? "Frete grátis"
                  : `${cupom.valor_desconto}% de desconto`}
                {cupom.minimo_itens > 0 ? ` · ${cupom.minimo_itens}+ lanches` : " · sem mínimo"}
              </p>
              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-sm font-medium">
                  {cupom.ativo ? "Ativo no site" : "Desativado"}
                </span>
                <Switch
                  checked={cupom.ativo}
                  onCheckedChange={(ativo) => alternarAtivo(cupom, ativo)}
                  aria-label={`Ativar ${cupom.codigo}`}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
