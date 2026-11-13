-- =====================================================================
--  Whazaa · Licencias (inicio de sesión y control de acceso)
--  Pegá TODO este archivo en Supabase → SQL Editor → New query → Run.
--  Se puede volver a ejecutar sin romper nada.
-- =====================================================================

-- ---------- Tablas ----------

-- Una licencia por usuario. Las cuentas nuevas quedan INACTIVAS hasta
-- que un administrador las activa desde el panel.
create table if not exists public.licencias (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  email            text not null,
  nombre           text not null default '',
  activo           boolean not null default false,
  vence            timestamptz,            -- null = no vence
  max_dispositivos int not null default 1 check (max_dispositivos between 1 and 20),
  nota             text not null default '',
  creado           timestamptz not null default now(),
  ultimo_acceso    timestamptz
);

-- Computadoras donde se usa cada cuenta (para que no la compartan).
create table if not exists public.dispositivos (
  user_id    uuid not null references public.licencias (user_id) on delete cascade,
  device_id  text not null,
  nombre     text not null default '',
  creado     timestamptz not null default now(),
  ultimo_uso timestamptz not null default now(),
  primary key (user_id, device_id)
);

-- Quiénes pueden entrar al panel de administración.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ---------- Funciones ----------

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Al registrarse alguien, se le crea su licencia (inactiva).
create or replace function public.nueva_licencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.licencias (user_id, email, nombre)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'nombre', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists whazaa_nueva_licencia on auth.users;
create trigger whazaa_nueva_licencia
  after insert on auth.users
  for each row execute function public.nueva_licencia();

-- La extensión llama a esta función al abrir WhatsApp Web y cada 30 minutos.
-- Devuelve { ok: true } o { ok: false, motivo: ... } y registra la computadora.
create or replace function public.verificar_licencia(p_device text, p_nombre text default '')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.licencias;
  n int;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'motivo', 'sin_sesion');
  end if;
  select * into l from public.licencias where user_id = auth.uid();
  if not found then
    return json_build_object('ok', false, 'motivo', 'sin_licencia');
  end if;
  if not l.activo then
    return json_build_object('ok', false, 'motivo', 'inactiva');
  end if;
  if l.vence is not null and l.vence < now() then
    return json_build_object('ok', false, 'motivo', 'vencida', 'vence', l.vence);
  end if;
  if coalesce(p_device, '') = '' then
    return json_build_object('ok', false, 'motivo', 'sin_dispositivo');
  end if;
  if exists (select 1 from public.dispositivos where user_id = auth.uid() and device_id = p_device) then
    update public.dispositivos set ultimo_uso = now() where user_id = auth.uid() and device_id = p_device;
  else
    select count(*) into n from public.dispositivos where user_id = auth.uid();
    if n >= l.max_dispositivos then
      return json_build_object('ok', false, 'motivo', 'dispositivos', 'max', l.max_dispositivos);
    end if;
    insert into public.dispositivos (user_id, device_id, nombre)
    values (auth.uid(), p_device, left(coalesce(p_nombre, ''), 80));
  end if;
  update public.licencias set ultimo_acceso = now() where user_id = auth.uid();
  return json_build_object('ok', true, 'vence', l.vence, 'nombre', l.nombre, 'admin', public.es_admin());
end;
$$;

revoke all on function public.verificar_licencia(text, text) from public, anon;
grant execute on function public.verificar_licencia(text, text) to authenticated;
revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- ---------- Seguridad (Row Level Security) ----------
-- Cada usuario sólo ve SU licencia. Sólo los administradores ven y cambian todo.

alter table public.licencias    enable row level security;
alter table public.dispositivos enable row level security;
alter table public.admins       enable row level security;

drop policy if exists "licencia propia o admin" on public.licencias;
create policy "licencia propia o admin" on public.licencias
  for select to authenticated using (user_id = auth.uid() or public.es_admin());

drop policy if exists "admin cambia licencias" on public.licencias;
create policy "admin cambia licencias" on public.licencias
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin borra licencias" on public.licencias;
create policy "admin borra licencias" on public.licencias
  for delete to authenticated using (public.es_admin());

drop policy if exists "dispositivos propios o admin" on public.dispositivos;
create policy "dispositivos propios o admin" on public.dispositivos
  for select to authenticated using (user_id = auth.uid() or public.es_admin());

drop policy if exists "admin libera dispositivos" on public.dispositivos;
create policy "admin libera dispositivos" on public.dispositivos
  for delete to authenticated using (public.es_admin());

drop policy if exists "ver si soy admin" on public.admins;
create policy "ver si soy admin" on public.admins
  for select to authenticated using (user_id = auth.uid());

grant select, update, delete on public.licencias to authenticated;
grant select, delete on public.dispositivos to authenticated;
grant select on public.admins to authenticated;
revoke all on public.licencias, public.dispositivos, public.admins from anon;

-- Licencias para usuarios que ya existían antes de correr este archivo.
insert into public.licencias (user_id, email)
select id, coalesce(email, '') from auth.users
on conflict (user_id) do nothing;

-- =====================================================================
--  ÚLTIMO PASO: hacete administrador.
--  1) Creá tu cuenta desde la extensión (o en Authentication → Users → Add user).
--  2) Cambiá el email de abajo por el tuyo y ejecutá estas 3 líneas:
--
--  insert into public.admins (user_id) select id from auth.users where email = 'TU_EMAIL@gmail.com' on conflict do nothing;
--  update public.licencias set activo = true, max_dispositivos = 5 where email = 'TU_EMAIL@gmail.com';
--  select * from public.licencias;
-- =====================================================================
