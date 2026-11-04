import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Percent, Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

function CupomPrimeiraCompra() {
  const [codigo, setCodigo] = useState("PRIMEIRACOMPRA");
  const [descricao, setDescricao] = useState("Desconto na primeira compra");
  const [tipo, setTipo] = useState<"percentual" | "frete_gratis">("percentual");
  const [valor, setValor] = useState("10");
  const [ativo, setAtivo] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let active = true;
    const updateAdmin = (
      user: { app_metadata?: Record<string, unknown> } | undefined,
    ) => {
      if (active) setAdmin(user?.app_metadata?.role === "admin");
    };
    void supabase.auth
      .getSession()
      .then(({ data }) => updateAdmin(data.session?.user));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => updateAdmin(session?.user),
    );
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("cupons")
          .select("*")
          .eq("primeira_compra", true)
          .maybeSingle();
        if (!active) return;
        if (error) throw error;
        if (data) {
          setCodigo(data.codigo);
          setDescricao(data.descricao);
          setTipo(data.tipo_desconto);
          setValor(String(data.valor_desconto));
          setAtivo(data.ativo);
        }
      } catch {
        if (active)
          setErro(
            "Não foi possível carregar o cupom. Verifique a conexão e se a migração de primeira compra foi aplicada no Supabase.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (error) throw error;
      setSenha("");
      if (data.user?.app_metadata.role !== "admin")
        toast.error("Este usuário não possui permissão de administrador.");
    } catch {
      toast.error("Não foi possível entrar. Confira seu e-mail e senha.");
    } finally {
      setSaving(false);
    }
  };

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    const percentual = Number(valor.replace(",", "."));
    if (!codigo.trim() || !descricao.trim())
      return toast.error("Preencha o código e a descrição.");
    if (
      tipo === "percentual" &&
      (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100)
    ) {
      return toast.error("Informe um desconto maior que 0 e até 100%.");
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("salvar_cupom_primeira_compra", {
        p_codigo: codigo.trim().toUpperCase(),
        p_descricao: descricao.trim(),
        p_tipo: tipo,
        p_valor: tipo === "frete_gratis" ? 0 : percentual,
        p_ativo: ativo,
      });
      if (error) throw error;
      setCodigo(codigo.trim().toUpperCase());
      toast.success("Cupom de primeira compra salvo!");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o cupom. Confira a permissão de administrador e se o código já está em uso.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Cupom de primeira compra</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Válido apenas para o primeiro pedido não cancelado de cada WhatsApp
          com DDD. Alterar o nome do cupom não libera um novo uso para o mesmo
          número.
        </p>
      </div>
      {loading && <p role="status">Carregando cupom...</p>}
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      {!admin && (
        <form onSubmit={login} className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">
            Entre como administrador para editar o cupom.
          </p>
          <label className="block text-sm">
            E-mail
            <Input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            Senha
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      )}
      <form onSubmit={salvar} className="space-y-5">
        <fieldset
          disabled={!admin || loading || saving || !!erro}
          className="space-y-5 disabled:opacity-60"
        >
          <label className="block text-sm font-medium">
            Código do cupom
            <Input
              required
              maxLength={30}
              value={codigo}
              onChange={(event) => setCodigo(event.target.value.toUpperCase())}
              placeholder="Ex: PRIMEIRACOMPRA"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              É o nome que o cliente digita no site.
            </span>
          </label>
          <label className="block text-sm font-medium">
            Descrição
            <Input
              required
              maxLength={200}
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              placeholder="Ex: Boas-vindas à BolaBurguer"
            />
          </label>
          <label className="block text-sm font-medium">
            Benefício
            <select
              value={tipo}
              onChange={(event) => setTipo(event.target.value as typeof tipo)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="percentual">Desconto em porcentagem</option>
              <option value="frete_gratis">Frete grátis</option>
            </select>
          </label>
          {tipo === "percentual" && (
            <label className="block text-sm font-medium">
              Desconto (%)
              <Input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                required
                value={valor}
                onChange={(event) => setValor(event.target.value)}
              />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(event) => setAtivo(event.target.checked)}
            />{" "}
            Cupom ativo no site
          </label>
          <p className="text-sm text-muted-foreground">
            {tipo === "frete_gratis"
              ? "Zera a taxa de entrega; não desconta o valor dos produtos."
              : "A porcentagem é aplicada aos produtos; a taxa de entrega permanece."}
          </p>
          <Button type="submit">
            {saving ? "Salvando..." : "Salvar cupom"}
          </Button>
        </fieldset>
      </form>
    </Card>
  );
}

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

function CuponsGerais() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<TipoDesconto>("percentual");
  const [percentual, setPercentual] = useState(5);
  const [minimoItens, setMinimoItens] = useState(0);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("cupons")
      .select(
        "id, codigo, descricao, tipo_desconto, valor_desconto, minimo_itens, ativo",
      )
      .eq("primeira_compra", false)
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

  const criarCupom = async (event: FormEvent) => {
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
        primeira_compra: false,
      })
      .select(
        "id, codigo, descricao, tipo_desconto, valor_desconto, minimo_itens, ativo",
      )
      .single();
    setSalvando(false);
    if (error) {
      console.error(error);
      return toast.error(
        error.code === "23505"
          ? "Esse código já existe."
          : "Não foi possível criar o cupom.",
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
    setCupons((atual) =>
      atual.map((item) => (item.id === cupom.id ? { ...item, ativo } : item)),
    );
    const { error } = await supabase
      .from("cupons")
      .update({ ativo })
      .eq("id", cupom.id)
      .eq("primeira_compra", false);
    if (error) {
      setCupons((atual) =>
        atual.map((item) =>
          item.id === cupom.id ? { ...item, ativo: cupom.ativo } : item,
        ),
      );
      return toast.error("Não foi possível atualizar o cupom.");
    }
    toast.success(ativo ? "Cupom ativado no site." : "Cupom desativado.");
  };

  const excluirCupom = async (cupom: Cupom) => {
    if (
      !window.confirm(
        `Excluir o cupom ${cupom.codigo}? Esta ação não pode ser desfeita.`,
      )
    )
      return;

    setExcluindoId(cupom.id);
    const { error } = await supabase
      .from("cupons")
      .delete()
      .eq("id", cupom.id)
      .eq("primeira_compra", false);
    setExcluindoId(null);

    if (error) {
      console.error(error);
      return toast.error("Não foi possível excluir o cupom.");
    }

    setCupons((atual) => atual.filter((item) => item.id !== cupom.id));
    toast.success("Cupom excluído.");
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Cupons de desconto</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Crie o código e o nome que quiser. O cliente só consegue usar cupons
          ativos.
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
              <option value={3}>A partir de 3 lanches</option>
              <option value={4}>A partir de 4 lanches</option>
              <option value={5}>A partir de 5 lanches</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={salvando}
              className="gap-2 w-full sm:w-auto"
            >
              <Plus className="size-4" />
              {salvando ? "Criando..." : "Criar cupom"}
            </Button>
          </div>
        </form>
      </Card>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando cupons...</p>
      ) : cupons.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Nenhum cupom criado ainda.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cupons.map((cupom) => (
            <Card key={cupom.id} className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold truncate">{cupom.descricao}</p>
                  <p className="font-mono text-sm text-primary mt-1">
                    {cupom.codigo}
                  </p>
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
                {cupom.minimo_itens > 0
                  ? ` · ${cupom.minimo_itens}+ lanches`
                  : " · sem mínimo"}
              </p>
              <div className="flex items-center justify-between gap-3 border-t pt-4">
                <span className="text-sm font-medium">
                  {cupom.ativo ? "Ativo no site" : "Desativado"}
                </span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={cupom.ativo}
                    onCheckedChange={(ativo) => alternarAtivo(cupom, ativo)}
                    aria-label={`Ativar ${cupom.codigo}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => excluirCupom(cupom)}
                    disabled={excluindoId === cupom.id}
                    aria-label={`Excluir ${cupom.codigo}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export function CuponsSection() {
  return (
    <div className="space-y-8">
      <CuponsGerais />
      <CupomPrimeiraCompra />
    </div>
  );
}
