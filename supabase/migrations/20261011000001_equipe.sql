-- Login da equipe (Supabase Auth) no dashboard e no app.
-- Só entra quem tiver uma linha aqui, mesmo que exista o usuário em Authentication.
-- O papel ainda não limita nada: dono, dev e atendente têm acesso total por enquanto.
-- Pode rodar antes de fechar o acesso público; não muda o que o site, o dashboard e o app
-- já fazem.
create table if not exists public.equipe (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  papel text not null check (papel in ('dono', 'dev', 'atendente')),
  created_at timestamptz not null default now()
);

-- Cada pessoa só lê a própria linha (o dashboard e o app conferem o acesso no login).
-- Ninguém altera a equipe pela chave pública; cadastro e remoção são feitos no SQL Editor.
alter table public.equipe enable row level security;
revoke all on public.equipe from anon, authenticated;
grant select on public.equipe to authenticated;
grant all on public.equipe to service_role;

drop policy if exists "equipe_le_propria_linha" on public.equipe;
create policy "equipe_le_propria_linha" on public.equipe
  for select to authenticated using (user_id = auth.uid());

-- Usada nas policies e nas funções para saber se quem chamou é da equipe.
create or replace function public.eh_equipe()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipe where user_id = auth.uid());
$$;

revoke execute on function public.eh_equipe() from public, anon;
grant execute on function public.eh_equipe() to authenticated;
