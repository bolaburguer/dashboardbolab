import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Flame, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

type Estado = { tipo: "carregando" } | { tipo: "deslogado"; erro?: string } | { tipo: "liberado" };

// Só mostra o dashboard para quem fez login e está cadastrado em public.equipe.
// Quem protege os dados são as policies do banco; aqui é a porta de entrada.
export function AuthGate({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);

  const conferirAcesso = useCallback(async (session: Session | null) => {
    if (!session) {
      setEstado({ tipo: "deslogado" });
      return;
    }
    const { data, error } = await supabase
      .from("equipe")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error(error);
      await supabase.auth.signOut();
      setEstado({
        tipo: "deslogado",
        erro: error
          ? "Não foi possível conferir seu acesso. Tente novamente."
          : "Este usuário não tem acesso ao dashboard.",
      });
      return;
    }
    setEstado({ tipo: "liberado" });
  }, []);

  useEffect(() => {
    // Sem Supabase configurado, o dashboard mostra o próprio aviso de configuração.
    if (!isSupabaseConfigured()) {
      setEstado({ tipo: "liberado" });
      return;
    }

    void supabase.auth.getSession().then(({ data }) => conferirAcesso(data.session));

    // Não chamar o Supabase dentro deste callback (a biblioteca pode travar); só reagir à saída,
    // que também acontece quando a sessão expira ou é encerrada em outra aba.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setEstado((atual) => (atual.tipo === "deslogado" ? atual : { tipo: "deslogado" }));
      }
    });
    return () => subscription.unsubscribe();
  }, [conferirAcesso]);

  const entrar = async (event: FormEvent) => {
    event.preventDefault();
    setEntrando(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) {
      setEntrando(false);
      setEstado({
        tipo: "deslogado",
        erro:
          error.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : "Não foi possível entrar. Tente novamente.",
      });
      return;
    }
    await conferirAcesso(data.session);
    setSenha("");
    setEntrando(false);
  };

  if (estado.tipo === "liberado") return <>{children}</>;

  if (estado.tipo === "carregando") {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--gradient-surface)] text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-[var(--gradient-surface)] px-4">
      <Card className="w-full max-w-sm p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Flame className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">BolaBurguer Dashboard</h1>
            <p className="text-xs text-muted-foreground">Entre com seu e-mail e senha</p>
          </div>
        </div>

        <form onSubmit={entrar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              required
            />
          </div>
          {estado.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
          <Button type="submit" className="w-full gap-2" disabled={entrando}>
            <LogIn className="size-4" />
            {entrando ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground">
          Esqueceu a senha? Peça para o responsável redefinir no Supabase.
        </p>
      </Card>
    </div>
  );
}
