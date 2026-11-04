alter table public.pedidos
  add column if not exists historico_status jsonb not null default '[]'::jsonb;

create or replace function public.registrar_historico_status_pedido()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    NEW.historico_status := '[]'::jsonb;
    if NEW.status <> 'pendente' then
      NEW.historico_status := jsonb_build_array(jsonb_build_object(
        'status', NEW.status, 'registrado_em', clock_timestamp()));
    end if;
  else
    NEW.historico_status := OLD.historico_status;
    if NEW.status is distinct from OLD.status then
      NEW.historico_status := NEW.historico_status || jsonb_build_array(jsonb_build_object(
        'status', NEW.status, 'registrado_em', clock_timestamp()));
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists pedidos_registrar_historico_status on public.pedidos;
create trigger pedidos_registrar_historico_status
before insert or update on public.pedidos
for each row execute function public.registrar_historico_status_pedido();
