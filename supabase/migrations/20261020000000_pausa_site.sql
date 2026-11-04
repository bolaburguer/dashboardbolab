-- Pausa exclusiva do site. Pedidos manuais da equipe continuam permitidos.
begin;
create table public.operacao_site (
  id boolean primary key default true check (id),
  pausado boolean not null default false
);
insert into public.operacao_site (id) values (true);
alter table public.operacao_site enable row level security;
revoke all on public.operacao_site from anon, authenticated;

create function public.pedidos_site_disponiveis()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.operacao_site where id and not pausado)
     and exists (select 1 from public.turnos where encerrado_em is null);
$$;
create function public.site_pausado()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select pausado from public.operacao_site where id), true); $$;
create function public.definir_pausa_site(p_pausado boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.eh_equipe() then raise exception 'Acesso negado'; end if;
  if p_pausado is null then raise exception 'Informe a pausa'; end if;
  update public.operacao_site set pausado = p_pausado where id;
end;
$$;
revoke all on function public.pedidos_site_disponiveis() from public, anon, authenticated;
revoke all on function public.site_pausado() from public, anon, authenticated;
revoke all on function public.definir_pausa_site(boolean) from public, anon, authenticated;
grant execute on function public.pedidos_site_disponiveis() to anon, authenticated, service_role;
grant execute on function public.site_pausado() to authenticated;
grant execute on function public.definir_pausa_site(boolean) to authenticated;

-- Restritiva: bloqueia anon mesmo se uma policy permissiva antiga ainda existir.
create policy pedidos_site_exige_disponibilidade on public.pedidos
  as restrictive for insert to anon
  with check (public.pedidos_site_disponiveis());
commit;
