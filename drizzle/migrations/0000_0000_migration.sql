
-- ===== ENUMS =====
create type public.rol_estudio as enum ('admin', 'abogado', 'asistente');
create type public.tipo_documento as enum ('DNI', 'RUC', 'CE', 'PASAPORTE');

-- ===== PROFILES =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null default '',
  email text,
  colegiatura text,
  telefono text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre_completo, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre_completo', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ===== ESTUDIOS (tenants) =====
create table public.estudios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  ruc text,
  direccion text,
  departamento text,
  provincia text,
  distrito text,
  telefono text,
  email text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.estudios to authenticated;
grant all on public.estudios to service_role;
alter table public.estudios enable row level security;

create table public.estudio_miembros (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  user_id uuid not null,
  rol public.rol_estudio not null default 'abogado',
  created_at timestamptz not null default now(),
  unique (estudio_id, user_id)
);
create index on public.estudio_miembros(user_id);
grant select, update, delete on public.estudio_miembros to authenticated;
grant all on public.estudio_miembros to service_role;
alter table public.estudio_miembros enable row level security;

create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  email text not null,
  rol public.rol_estudio not null default 'abogado',
  invitado_por uuid not null default auth.uid(),
  aceptada_at timestamptz,
  created_at timestamptz not null default now(),
  unique (estudio_id, email)
);
grant select, insert, delete on public.invitaciones to authenticated;
grant all on public.invitaciones to service_role;
alter table public.invitaciones enable row level security;

create or replace function public.es_miembro(_estudio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.estudio_miembros where estudio_id = _estudio and user_id = auth.uid())
$$;
create or replace function public.tiene_rol(_estudio uuid, _rol public.rol_estudio)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.estudio_miembros where estudio_id = _estudio and user_id = auth.uid() and rol = _rol)
$$;
create or replace function public.comparte_estudio(_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.estudio_miembros a join public.estudio_miembros b on a.estudio_id = b.estudio_id
    where a.user_id = auth.uid() and b.user_id = _user)
$$;

create policy "ver perfil propio o de colegas" on public.profiles for select to authenticated
  using (id = auth.uid() or public.comparte_estudio(id));
create policy "insertar perfil propio" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "editar perfil propio" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "miembros ven su estudio" on public.estudios for select to authenticated using (public.es_miembro(id));
create policy "admin edita estudio" on public.estudios for update to authenticated using (public.tiene_rol(id, 'admin')) with check (public.tiene_rol(id, 'admin'));

create policy "miembros ven equipo" on public.estudio_miembros for select to authenticated using (public.es_miembro(estudio_id));
create policy "admin cambia roles" on public.estudio_miembros for update to authenticated using (public.tiene_rol(estudio_id, 'admin')) with check (public.tiene_rol(estudio_id, 'admin'));
create policy "admin retira miembros" on public.estudio_miembros for delete to authenticated using (public.tiene_rol(estudio_id, 'admin') and user_id <> auth.uid());

create policy "admin o invitado ve invitaciones" on public.invitaciones for select to authenticated
  using (public.tiene_rol(estudio_id, 'admin') or lower(email) = lower(auth.jwt()->>'email'));
create policy "admin invita" on public.invitaciones for insert to authenticated with check (public.tiene_rol(estudio_id, 'admin'));
create policy "admin borra invitacion" on public.invitaciones for delete to authenticated using (public.tiene_rol(estudio_id, 'admin'));

create or replace function public.crear_estudio(_nombre text, _ruc text default null, _departamento text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if coalesce(trim(_nombre), '') = '' then raise exception 'El nombre del estudio es obligatorio'; end if;
  insert into public.estudios (nombre, ruc, departamento, created_by) values (trim(_nombre), nullif(trim(_ruc), ''), _departamento, auth.uid()) returning id into _id;
  insert into public.estudio_miembros (estudio_id, user_id, rol) values (_id, auth.uid(), 'admin');
  return _id;
end; $$;
revoke execute on function public.crear_estudio(text, text, text) from public, anon;
grant execute on function public.crear_estudio(text, text, text) to authenticated;

create or replace function public.aceptar_invitacion(_invitacion uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _inv public.invitaciones;
begin
  select * into _inv from public.invitaciones where id = _invitacion and aceptada_at is null;
  if _inv.id is null then raise exception 'Invitación no encontrada'; end if;
  if lower(_inv.email) <> lower(auth.jwt()->>'email') then raise exception 'Esta invitación es para otro correo'; end if;
  insert into public.estudio_miembros (estudio_id, user_id, rol) values (_inv.estudio_id, auth.uid(), _inv.rol)
    on conflict (estudio_id, user_id) do nothing;
  update public.invitaciones set aceptada_at = now() where id = _inv.id;
  return _inv.estudio_id;
end; $$;
revoke execute on function public.aceptar_invitacion(uuid) from public, anon;
grant execute on function public.aceptar_invitacion(uuid) to authenticated;

-- ===== CLIENTES =====
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  tipo_persona text not null default 'natural' check (tipo_persona in ('natural','juridica')),
  tipo_documento public.tipo_documento not null default 'DNI',
  numero_documento text not null,
  nombres text,
  apellidos text,
  razon_social text,
  representante_legal text,
  email text,
  telefono text,
  direccion text,
  departamento text,
  provincia text,
  distrito text,
  estado text not null default 'activo' check (estado in ('prospecto','activo','inactivo')),
  origen text,
  notas text,
  responsable_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (estudio_id, tipo_documento, numero_documento)
);
create index on public.clientes(estudio_id);

create table public.expedientes (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  titulo text not null,
  numero_expediente text,
  materia text not null default 'civil',
  tipo_proceso text,
  via text not null default 'judicial' check (via in ('judicial','administrativa','arbitral','fiscal','extrajudicial')),
  distrito_judicial text,
  organo_jurisdiccional text,
  juez text,
  especialista text,
  estado text not null default 'en_tramite' check (estado in ('en_tramite','suspendido','concluido','archivado')),
  etapa text,
  cuantia numeric(14,2),
  fecha_inicio date,
  descripcion text,
  responsable_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.expedientes(estudio_id);
create index on public.expedientes(cliente_id);

create table public.partes_procesales (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  expediente_id uuid not null references public.expedientes(id) on delete cascade,
  nombre text not null,
  tipo_documento public.tipo_documento,
  numero_documento text,
  rol text not null,
  abogado text,
  es_cliente boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.partes_procesales(expediente_id);

create table public.actuaciones (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  expediente_id uuid not null references public.expedientes(id) on delete cascade,
  fecha date not null default current_date,
  tipo text not null default 'nota',
  descripcion text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.actuaciones(expediente_id);

create table public.plazos (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  expediente_id uuid references public.expedientes(id) on delete cascade,
  titulo text not null,
  tipo text not null default 'tarea' check (tipo in ('plazo_procesal','tarea')),
  fecha_notificacion date,
  dias_habiles integer,
  fecha_vencimiento date not null,
  prioridad text not null default 'media' check (prioridad in ('baja','media','alta')),
  estado text not null default 'pendiente' check (estado in ('pendiente','completado')),
  asignado_a uuid,
  notas text,
  completado_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.plazos(estudio_id, fecha_vencimiento);

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  expediente_id uuid references public.expedientes(id) on delete cascade,
  titulo text not null,
  tipo text not null default 'audiencia' check (tipo in ('audiencia','reunion','diligencia','informe_oral','otro')),
  inicio timestamptz not null,
  fin timestamptz,
  modalidad text not null default 'presencial' check (modalidad in ('presencial','virtual')),
  lugar text,
  enlace text,
  responsable_id uuid,
  notas text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.eventos(estudio_id, inicio);

create table public.honorarios (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  expediente_id uuid references public.expedientes(id) on delete set null,
  concepto text not null,
  modalidad text not null default 'fijo' check (modalidad in ('fijo','por_hora','cuota_litis','iguala','mixto')),
  monto_total numeric(14,2) not null default 0 check (monto_total >= 0),
  moneda text not null default 'PEN' check (moneda in ('PEN','USD')),
  fecha date not null default current_date,
  notas text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.honorarios(estudio_id);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  honorario_id uuid not null references public.honorarios(id) on delete cascade,
  monto numeric(14,2) not null check (monto > 0),
  fecha date not null default current_date,
  metodo text not null default 'transferencia' check (metodo in ('efectivo','transferencia','yape','plin','tarjeta','deposito','otro')),
  tipo_comprobante text check (tipo_comprobante in ('boleta','factura','recibo_honorarios','ninguno')),
  numero_comprobante text,
  notas text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.pagos(honorario_id);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  expediente_id uuid references public.expedientes(id) on delete set null,
  concepto text not null,
  categoria text not null default 'otros' check (categoria in ('tasas_judiciales','cedulas','copias','notaria','registros','movilidad','peritos','otros')),
  monto numeric(14,2) not null check (monto > 0),
  fecha date not null default current_date,
  reembolsable boolean not null default true,
  notas text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.gastos(estudio_id);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  expediente_id uuid references public.expedientes(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  nombre text not null,
  categoria text not null default 'otro',
  storage_path text not null unique,
  mime_type text,
  tamano bigint,
  subido_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.documentos(expediente_id);

create table public.auditoria (
  id bigint generated always as identity primary key,
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  tabla text not null,
  registro_id uuid,
  accion text not null,
  user_id uuid,
  resumen text,
  created_at timestamptz not null default now()
);
create index on public.auditoria(estudio_id, created_at desc);
grant select on public.auditoria to authenticated;
grant all on public.auditoria to service_role;
alter table public.auditoria enable row level security;
create policy "admin ve auditoria" on public.auditoria for select to authenticated using (public.tiene_rol(estudio_id, 'admin'));

create or replace function public.registrar_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare _row jsonb; _resumen text;
begin
  _row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  _resumen := coalesce(_row->>'titulo', _row->>'concepto', _row->>'nombre', _row->>'razon_social',
    nullif(trim(coalesce(_row->>'nombres','') || ' ' || coalesce(_row->>'apellidos','')), ''), _row->>'descripcion');
  insert into public.auditoria (estudio_id, tabla, registro_id, accion, user_id, resumen)
  values ((_row->>'estudio_id')::uuid, tg_table_name, (_row->>'id')::uuid, lower(tg_op), auth.uid(), left(_resumen, 200));
  return null;
end; $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array['clientes','expedientes','partes_procesales','actuaciones','plazos','eventos','honorarios','pagos','gastos','documentos'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "miembros leen" on public.%I for select to authenticated using (public.es_miembro(estudio_id))', t);
    execute format('create policy "miembros crean" on public.%I for insert to authenticated with check (public.es_miembro(estudio_id))', t);
    execute format('create policy "miembros editan" on public.%I for update to authenticated using (public.es_miembro(estudio_id)) with check (public.es_miembro(estudio_id))', t);
    execute format('create policy "abogados y admin eliminan" on public.%I for delete to authenticated using (public.tiene_rol(estudio_id, ''admin'') or public.tiene_rol(estudio_id, ''abogado''))', t);
    execute format('create trigger auditoria_%I after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t, t);
  end loop;
  foreach t in array array['profiles','estudios','clientes','expedientes','plazos','eventos','honorarios'] loop
    execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

drop policy "miembros leen" on public.honorarios;
drop policy "miembros leen" on public.pagos;
create policy "abogados y admin leen honorarios" on public.honorarios for select to authenticated
  using (public.tiene_rol(estudio_id, 'admin') or public.tiene_rol(estudio_id, 'abogado'));
create policy "abogados y admin leen pagos" on public.pagos for select to authenticated
  using (public.tiene_rol(estudio_id, 'admin') or public.tiene_rol(estudio_id, 'abogado'));

create policy "miembros leen documentos" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and public.es_miembro(((storage.foldername(name))[1])::uuid));
create policy "miembros suben documentos" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.es_miembro(((storage.foldername(name))[1])::uuid));
create policy "abogados borran documentos" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and (public.tiene_rol(((storage.foldername(name))[1])::uuid, 'admin') or public.tiene_rol(((storage.foldername(name))[1])::uuid, 'abogado')));