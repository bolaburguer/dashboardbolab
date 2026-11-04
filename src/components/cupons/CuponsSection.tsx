import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function CuponsSection() {
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
    const updateAdmin = (user: { app_metadata?: Record<string, unknown> } | undefined) => {
      if (active) setAdmin(user?.app_metadata?.role === "admin");
    };
    void supabase.auth.getSession().then(({ data }) => updateAdmin(data.session?.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) =>
      updateAdmin(session?.user),
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
    if (!codigo.trim() || !descricao.trim()) return toast.error("Preencha o código e a descrição.");
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
          Válido apenas para o primeiro pedido não cancelado de cada WhatsApp com DDD. Alterar o
          nome do cupom não libera um novo uso para o mesmo número.
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
          <p className="text-sm font-medium">Entre como administrador para editar o cupom.</p>
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
          <Button type="submit">{saving ? "Salvando..." : "Salvar cupom"}</Button>
        </fieldset>
      </form>
    </Card>
  );
}
