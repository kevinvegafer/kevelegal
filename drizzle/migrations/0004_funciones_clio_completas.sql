-- ===== 1. Tareas: subtareas y dependencias =====
alter table public.plazos add column parent_id uuid references public.plazos(id) on delete cascade;
alter table public.plazos add column depende_de uuid references public.plazos(id) on delete set null;
alter table public.plazos add column desfase_dias integer not null default 0;
create index on public.plazos(parent_id);
create index on public.plazos(depende_de);

-- ===== 2. Vistas guardadas =====
create table public.vistas_guardadas (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  modulo text not null default 'expedientes' check (modulo in ('expedientes','clientes','plazos')),
  nombre text not null,
  filtros jsonb not null default '{}'::jsonb,
  compartida boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.vistas_guardadas(estudio_id, modulo);
grant select, insert, update, delete on public.vistas_guardadas to authenticated;
grant all on public.vistas_guardadas to service_role;
alter table public.vistas_guardadas enable row level security;
create policy "ver vistas propias o compartidas" on public.vistas_guardadas for select to authenticated
  using (public.es_miembro(estudio_id) and (user_id = auth.uid() or compartida));
create policy "crear vistas propias" on public.vistas_guardadas for insert to authenticated
  with check (public.es_miembro(estudio_id) and user_id = auth.uid());
create policy "editar vistas propias" on public.vistas_guardadas for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.es_miembro(estudio_id));
create policy "borrar vistas propias" on public.vistas_guardadas for delete to authenticated
  using (user_id = auth.uid());

-- ===== 3. Recordatorios de eventos =====
alter table public.eventos add column recordatorios integer[];
alter table public.estudios add column recordatorios_evento jsonb not null default
  '{"audiencia":[1440,60],"informe_oral":[1440,60],"diligencia":[1440],"reunion":[30],"otro":[60]}'::jsonb;

-- ===== 4. Avisos (notificaciones) =====
create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  user_id uuid not null,
  tipo text not null default 'general',
  titulo text not null,
  detalle text,
  enlace text,
  created_at timestamptz not null default now()
);
create index on public.notificaciones(user_id, created_at desc);
grant select, delete on public.notificaciones to authenticated;
grant all on public.notificaciones to service_role;
alter table public.notificaciones enable row level security;
create policy "ver avisos propios" on public.notificaciones for select to authenticated
  using (user_id = auth.uid() and public.es_miembro(estudio_id));
create policy "borrar avisos propios" on public.notificaciones for delete to authenticated
  using (user_id = auth.uid());

create table public.avisos_descartados (
  user_id uuid not null default auth.uid(),
  clave text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, clave)
);
grant select, insert, delete on public.avisos_descartados to authenticated;
grant all on public.avisos_descartados to service_role;
alter table public.avisos_descartados enable row level security;
create policy "descartes propios ver" on public.avisos_descartados for select to authenticated using (user_id = auth.uid());
create policy "descartes propios crear" on public.avisos_descartados for insert to authenticated with check (user_id = auth.uid());
create policy "descartes propios borrar" on public.avisos_descartados for delete to authenticated using (user_id = auth.uid());

-- helper: notify the admins of a studio plus an optional extra user
create or replace function public.notificar_estudio(_estudio uuid, _extra uuid, _tipo text, _titulo text, _detalle text, _enlace text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notificaciones (estudio_id, user_id, tipo, titulo, detalle, enlace)
  select _estudio, u, _tipo, _titulo, left(_detalle, 300), _enlace
  from (
    select user_id as u from public.estudio_miembros where estudio_id = _estudio and rol = 'admin'
    union
    select _extra where _extra is not null and exists (select 1 from public.estudio_miembros where estudio_id = _estudio and user_id = _extra)
  ) x;
end; $$;
revoke execute on function public.notificar_estudio(uuid, uuid, text, text, text, text) from public, anon, authenticated;

-- ===== 5. Registro de tiempo =====
alter table public.estudios add column tarifa_hora numeric(14,2) not null default 0;
create table public.registros_tiempo (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  expediente_id uuid references public.expedientes(id) on delete set null,
  plazo_id uuid references public.plazos(id) on delete set null,
  documento_id uuid references public.documentos(id) on delete set null,
  descripcion text not null default '',
  fecha date not null default ((now() at time zone 'America/Lima')::date),
  en_curso boolean not null default false,
  ultimo_inicio timestamptz,
  segundos integer not null default 0 check (segundos >= 0),
  facturable boolean not null default true,
  tarifa_hora numeric(14,2),
  honorario_id uuid references public.honorarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.registros_tiempo(estudio_id, fecha desc);
create index on public.registros_tiempo(user_id) where en_curso;
grant select, insert, update, delete on public.registros_tiempo to authenticated;
grant all on public.registros_tiempo to service_role;
alter table public.registros_tiempo enable row level security;
create policy "miembros leen tiempo" on public.registros_tiempo for select to authenticated using (public.es_miembro(estudio_id));
create policy "registrar tiempo propio" on public.registros_tiempo for insert to authenticated
  with check (public.es_miembro(estudio_id) and user_id = auth.uid());
create policy "editar tiempo propio o admin" on public.registros_tiempo for update to authenticated
  using (user_id = auth.uid() or public.tiene_rol(estudio_id, 'admin') or public.tiene_rol(estudio_id, 'abogado'))
  with check (public.es_miembro(estudio_id));
create policy "borrar tiempo propio o abogado" on public.registros_tiempo for delete to authenticated
  using (user_id = auth.uid() or public.tiene_rol(estudio_id, 'admin') or public.tiene_rol(estudio_id, 'abogado'));
create trigger touch_registros_tiempo before update on public.registros_tiempo for each row execute function public.touch_updated_at();
create trigger auditoria_registros_tiempo after insert or update or delete on public.registros_tiempo for each row execute function public.registrar_auditoria();

-- ===== 6. Cuotas (plan de pagos) =====
create table public.cuotas (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  honorario_id uuid not null references public.honorarios(id) on delete cascade,
  numero integer not null default 1,
  monto numeric(14,2) not null check (monto > 0),
  fecha_vencimiento date not null,
  created_at timestamptz not null default now()
);
create index on public.cuotas(honorario_id, numero);
grant select, insert, update, delete on public.cuotas to authenticated;
grant all on public.cuotas to service_role;
alter table public.cuotas enable row level security;
create policy "abogados leen cuotas" on public.cuotas for select to authenticated
  using (public.tiene_rol(estudio_id, 'admin') or public.tiene_rol(estudio_id, 'abogado'));
create policy "abogados crean cuotas" on public.cuotas for insert to authenticated
  with check (public.tiene_rol(estudio_id, 'admin') or public.tiene_rol(estudio_id, 'abogado'));
create policy "abogados editan cuotas" on public.cuotas for update to authenticated
  using (public.tiene_rol(estudio_id, 'admin') or public.tiene_rol(estudio_id, 'abogado'))
  with check (public.tiene_rol(estudio_id, 'admin') or public.tiene_rol(estudio_id, 'abogado'));
create policy "abogados borran cuotas" on public.cuotas for delete to authenticated
  using (public.tiene_rol(estudio_id, 'admin') or public.tiene_rol(estudio_id, 'abogado'));
create trigger auditoria_cuotas after insert or update or delete on public.cuotas for each row execute function public.registrar_auditoria();

-- Bill selected time entries into a new fee agreement, atomically
create or replace function public.facturar_tiempo(_estudio uuid, _cliente uuid, _expediente uuid, _concepto text, _registros uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid; _total numeric(14,2);
begin
  if not (public.tiene_rol(_estudio, 'admin') or public.tiene_rol(_estudio, 'abogado')) then
    raise exception 'Sin permiso para facturar';
  end if;
  if not exists (select 1 from public.clientes where id = _cliente and estudio_id = _estudio) then
    raise exception 'Cliente no válido';
  end if;
  select coalesce(sum(round(r.segundos / 3600.0 * coalesce(r.tarifa_hora, e.tarifa_hora), 2)), 0) into _total
  from public.registros_tiempo r join public.estudios e on e.id = r.estudio_id
  where r.id = any(_registros) and r.estudio_id = _estudio and r.honorario_id is null and not r.en_curso and r.facturable;
  if _total <= 0 then raise exception 'No hay horas facturables seleccionadas'; end if;
  insert into public.honorarios (estudio_id, cliente_id, expediente_id, concepto, modalidad, monto_total)
  values (_estudio, _cliente, _expediente, coalesce(nullif(trim(_concepto), ''), 'Horas trabajadas'), 'por_hora', _total)
  returning id into _id;
  update public.registros_tiempo set honorario_id = _id
  where id = any(_registros) and estudio_id = _estudio and honorario_id is null and not en_curso and facturable;
  return _id;
end; $$;
revoke execute on function public.facturar_tiempo(uuid, uuid, uuid, text, uuid[]) from public, anon;
grant execute on function public.facturar_tiempo(uuid, uuid, uuid, text, uuid[]) to authenticated;

-- ===== 7. Documentos: versiones, visibilidad al cliente, enlaces que caducan =====
alter table public.documentos add column version integer not null default 1;
alter table public.documentos add column documento_origen uuid references public.documentos(id) on delete cascade;
alter table public.documentos add column visible_cliente boolean not null default false;
alter table public.documentos add column subido_por_cliente boolean not null default false;
create index on public.documentos(documento_origen);

create table public.enlaces_documento (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  documento_id uuid not null references public.documentos(id) on delete cascade,
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  expira_at timestamptz not null,
  revocado boolean not null default false,
  vistas integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.enlaces_documento(documento_id);
grant select, insert, update, delete on public.enlaces_documento to authenticated;
grant all on public.enlaces_documento to service_role;
alter table public.enlaces_documento enable row level security;
create policy "miembros leen enlaces" on public.enlaces_documento for select to authenticated using (public.es_miembro(estudio_id));
create policy "miembros crean enlaces" on public.enlaces_documento for insert to authenticated with check (public.es_miembro(estudio_id));
create policy "miembros revocan enlaces" on public.enlaces_documento for update to authenticated using (public.es_miembro(estudio_id)) with check (public.es_miembro(estudio_id));
create policy "abogados borran enlaces" on public.enlaces_documento for delete to authenticated
  using (public.tiene_rol(estudio_id, 'admin') or public.tiene_rol(estudio_id, 'abogado'));

-- ===== 8. Portal del cliente y mensajes =====
create table public.portal_accesos (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  activo boolean not null default true,
  expira_at timestamptz,
  ultimo_acceso timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.portal_accesos(cliente_id);
grant select, insert, update, delete on public.portal_accesos to authenticated;
grant all on public.portal_accesos to service_role;
alter table public.portal_accesos enable row level security;
create policy "miembros leen accesos" on public.portal_accesos for select to authenticated using (public.es_miembro(estudio_id));
create policy "miembros crean accesos" on public.portal_accesos for insert to authenticated with check (public.es_miembro(estudio_id));
create policy "miembros editan accesos" on public.portal_accesos for update to authenticated using (public.es_miembro(estudio_id)) with check (public.es_miembro(estudio_id));
create policy "abogados borran accesos" on public.portal_accesos for delete to authenticated
  using (public.tiene_rol(estudio_id, 'admin') or public.tiene_rol(estudio_id, 'abogado'));

create table public.mensajes_cliente (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  expediente_id uuid references public.expedientes(id) on delete set null,
  autor text not null default 'estudio' check (autor in ('estudio','cliente')),
  autor_id uuid default auth.uid(),
  cuerpo text not null check (length(trim(cuerpo)) > 0 and length(cuerpo) <= 5000),
  masivo boolean not null default false,
  leido_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.mensajes_cliente(cliente_id, created_at);
create index on public.mensajes_cliente(estudio_id, created_at desc);
grant select, insert, update, delete on public.mensajes_cliente to authenticated;
grant all on public.mensajes_cliente to service_role;
alter table public.mensajes_cliente enable row level security;
create policy "miembros leen mensajes" on public.mensajes_cliente for select to authenticated using (public.es_miembro(estudio_id));
create policy "miembros envían mensajes" on public.mensajes_cliente for insert to authenticated
  with check (public.es_miembro(estudio_id) and autor = 'estudio' and autor_id = auth.uid());
create policy "miembros marcan leído" on public.mensajes_cliente for update to authenticated using (public.es_miembro(estudio_id)) with check (public.es_miembro(estudio_id));
create policy "abogados borran mensajes" on public.mensajes_cliente for delete to authenticated
  using (public.tiene_rol(estudio_id, 'admin') or public.tiene_rol(estudio_id, 'abogado'));

create or replace function public.portal_acceso_valido(_token text)
returns public.portal_accesos language sql stable security definer set search_path = public as $$
  select * from public.portal_accesos
  where token = _token and activo and (expira_at is null or expira_at > now())
  limit 1
$$;
revoke execute on function public.portal_acceso_valido(text) from public, anon, authenticated;

create or replace function public.portal_datos(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _a public.portal_accesos; _res jsonb;
begin
  _a := public.portal_acceso_valido(_token);
  if _a.id is null then raise exception 'Enlace no válido o vencido'; end if;
  update public.portal_accesos set ultimo_acceso = now() where id = _a.id;
  select jsonb_build_object(
    'estudio', (select jsonb_build_object('nombre', e.nombre, 'telefono', e.telefono, 'email', e.email) from public.estudios e where e.id = _a.estudio_id),
    'cliente', (select jsonb_build_object('nombre', coalesce(nullif(c.razon_social, ''), trim(coalesce(c.nombres, '') || ' ' || coalesce(c.apellidos, ''))))
                from public.clientes c where c.id = _a.cliente_id),
    'expedientes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'titulo', x.titulo, 'numero', x.numero_expediente, 'estado', x.estado, 'materia', x.materia,
        'fase', f.nombre, 'fase_desde', x.fase_desde,
        'fases', (select coalesce(jsonb_agg(f2.nombre order by f2.orden), '[]'::jsonb) from public.fases f2 where f2.estudio_id = x.estudio_id),
        'proximos', (select coalesce(jsonb_agg(jsonb_build_object('titulo', ev.titulo, 'inicio', ev.inicio, 'tipo', ev.tipo, 'modalidad', ev.modalidad) order by ev.inicio), '[]'::jsonb)
                     from public.eventos ev where ev.expediente_id = x.id and ev.inicio > now())
      ) order by x.updated_at desc) from public.expedientes x left join public.fases f on f.id = x.fase_id
      where x.cliente_id = _a.cliente_id and x.estado <> 'archivado'), '[]'::jsonb),
    'documentos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'nombre', d.nombre, 'expediente_id', d.expediente_id,
        'created_at', d.created_at, 'tamano', d.tamano, 'mime_type', d.mime_type, 'subido_por_cliente', d.subido_por_cliente) order by d.created_at desc)
      from public.documentos d where d.cliente_id = _a.cliente_id and d.estudio_id = _a.estudio_id and (d.visible_cliente or d.subido_por_cliente)), '[]'::jsonb),
    'mensajes', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'autor', m.autor, 'cuerpo', m.cuerpo, 'created_at', m.created_at, 'expediente_id', m.expediente_id) order by m.created_at)
      from public.mensajes_cliente m where m.cliente_id = _a.cliente_id), '[]'::jsonb),
    'cuenta', coalesce((select jsonb_agg(jsonb_build_object('concepto', h.concepto, 'moneda', h.moneda, 'total', h.monto_total,
        'pagado', (select coalesce(sum(p.monto), 0) from public.pagos p where p.honorario_id = h.id),
        'cuotas', (select coalesce(jsonb_agg(jsonb_build_object('numero', q.numero, 'monto', q.monto, 'vence', q.fecha_vencimiento) order by q.numero), '[]'::jsonb)
                   from public.cuotas q where q.honorario_id = h.id)
      ) order by h.fecha desc) from public.honorarios h where h.cliente_id = _a.cliente_id), '[]'::jsonb)
  ) into _res;
  -- the client has now seen studio messages
  update public.mensajes_cliente set leido_at = now() where cliente_id = _a.cliente_id and autor = 'estudio' and leido_at is null;
  return _res;
end; $$;
revoke execute on function public.portal_datos(text) from public;
grant execute on function public.portal_datos(text) to anon, authenticated;

create or replace function public.portal_enviar_mensaje(_token text, _expediente uuid, _cuerpo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _a public.portal_accesos; _id uuid; _resp uuid;
begin
  _a := public.portal_acceso_valido(_token);
  if _a.id is null then raise exception 'Enlace no válido o vencido'; end if;
  if coalesce(length(trim(_cuerpo)), 0) = 0 then raise exception 'Escriba un mensaje'; end if;
  if length(_cuerpo) > 5000 then raise exception 'Mensaje demasiado largo'; end if;
  if _expediente is not null and not exists (select 1 from public.expedientes where id = _expediente and cliente_id = _a.cliente_id) then
    _expediente := null;
  end if;
  insert into public.mensajes_cliente (estudio_id, cliente_id, expediente_id, autor, autor_id, cuerpo)
  values (_a.estudio_id, _a.cliente_id, _expediente, 'cliente', null, trim(_cuerpo)) returning id into _id;
  select responsable_id into _resp from public.clientes where id = _a.cliente_id;
  perform public.notificar_estudio(_a.estudio_id, _resp, 'mensaje', 'Nuevo mensaje del cliente', trim(_cuerpo), '/clientes/' || _a.cliente_id);
  return _id;
end; $$;
revoke execute on function public.portal_enviar_mensaje(text, uuid, text) from public;
grant execute on function public.portal_enviar_mensaje(text, uuid, text) to anon, authenticated;

-- ===== 9. Agenda pública de citas =====
alter table public.estudios add column agenda_slug text unique;
alter table public.estudios add column agenda_activa boolean not null default false;
alter table public.estudios add column agenda_duracion_min integer not null default 30 check (agenda_duracion_min between 10 and 240);
alter table public.estudios add column agenda_anticipacion_horas integer not null default 12 check (agenda_anticipacion_horas between 0 and 720);

create table public.disponibilidad (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  user_id uuid not null,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fin time not null,
  created_at timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);
create index on public.disponibilidad(estudio_id);
grant select, insert, update, delete on public.disponibilidad to authenticated;
grant all on public.disponibilidad to service_role;
alter table public.disponibilidad enable row level security;
create policy "miembros leen disponibilidad" on public.disponibilidad for select to authenticated using (public.es_miembro(estudio_id));
create policy "propia o admin crea disponibilidad" on public.disponibilidad for insert to authenticated
  with check (public.es_miembro(estudio_id) and (user_id = auth.uid() or public.tiene_rol(estudio_id, 'admin')));
create policy "propia o admin edita disponibilidad" on public.disponibilidad for update to authenticated
  using (user_id = auth.uid() or public.tiene_rol(estudio_id, 'admin')) with check (public.es_miembro(estudio_id));
create policy "propia o admin borra disponibilidad" on public.disponibilidad for delete to authenticated
  using (user_id = auth.uid() or public.tiene_rol(estudio_id, 'admin'));

create table public.citas (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  user_id uuid not null,
  nombre text not null,
  email text,
  telefono text,
  motivo text,
  inicio timestamptz not null,
  fin timestamptz not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','confirmada','cancelada')),
  evento_id uuid references public.eventos(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.citas(estudio_id, inicio);
grant select, update, delete on public.citas to authenticated;
grant all on public.citas to service_role;
alter table public.citas enable row level security;
create policy "miembros leen citas" on public.citas for select to authenticated using (public.es_miembro(estudio_id));
create policy "miembros gestionan citas" on public.citas for update to authenticated using (public.es_miembro(estudio_id)) with check (public.es_miembro(estudio_id));
create policy "abogados borran citas" on public.citas for delete to authenticated
  using (public.tiene_rol(estudio_id, 'admin') or public.tiene_rol(estudio_id, 'abogado'));

create or replace function public.agenda_publica(_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _e public.estudios;
begin
  select * into _e from public.estudios where agenda_slug = lower(_slug) and agenda_activa;
  if _e.id is null then raise exception 'Agenda no disponible'; end if;
  return jsonb_build_object(
    'nombre', _e.nombre,
    'duracion', _e.agenda_duracion_min,
    'anticipacion_horas', _e.agenda_anticipacion_horas,
    'abogados', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.user_id,
        'nombre', coalesce(nullif(p.nombre_completo, ''), 'Abogado'),
        'franjas', (select jsonb_agg(jsonb_build_object('dia', d.dia_semana, 'desde', to_char(d.hora_inicio, 'HH24:MI'), 'hasta', to_char(d.hora_fin, 'HH24:MI')))
                    from public.disponibilidad d where d.estudio_id = _e.id and d.user_id = m.user_id)))
      from public.estudio_miembros m left join public.profiles p on p.id = m.user_id
      where m.estudio_id = _e.id and exists (select 1 from public.disponibilidad d where d.estudio_id = _e.id and d.user_id = m.user_id)), '[]'::jsonb),
    'ocupado', coalesce((select jsonb_agg(jsonb_build_object('user_id', o.u, 'inicio', o.i, 'fin', o.f)) from (
        select ev.responsable_id as u, ev.inicio as i, coalesce(ev.fin, ev.inicio + interval '1 hour') as f
        from public.eventos ev where ev.estudio_id = _e.id and ev.inicio between now() - interval '1 day' and now() + interval '45 days'
        union all
        select c.user_id, c.inicio, c.fin from public.citas c
        where c.estudio_id = _e.id and c.estado <> 'cancelada' and c.inicio between now() - interval '1 day' and now() + interval '45 days'
      ) o where o.u is not null), '[]'::jsonb)
  );
end; $$;
revoke execute on function public.agenda_publica(text) from public;
grant execute on function public.agenda_publica(text) to anon, authenticated;

create or replace function public.reservar_cita(_slug text, _user uuid, _inicio timestamptz, _nombre text, _email text, _telefono text, _motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _e public.estudios; _fin timestamptz; _local timestamp; _id uuid; _ev uuid;
begin
  select * into _e from public.estudios where agenda_slug = lower(_slug) and agenda_activa;
  if _e.id is null then raise exception 'Agenda no disponible'; end if;
  if coalesce(trim(_nombre), '') = '' then raise exception 'Indique su nombre'; end if;
  if coalesce(trim(_email), '') = '' and coalesce(trim(_telefono), '') = '' then raise exception 'Indique un correo o teléfono'; end if;
  if length(coalesce(_motivo, '')) > 2000 or length(_nombre) > 200 then raise exception 'Datos demasiado largos'; end if;
  if _inicio < now() + make_interval(hours => _e.agenda_anticipacion_horas) then raise exception 'Ese horario ya no está disponible'; end if;
  if _inicio > now() + interval '45 days' then raise exception 'Elija una fecha más cercana'; end if;
  _fin := _inicio + make_interval(mins => _e.agenda_duracion_min);
  _local := _inicio at time zone 'America/Lima';
  if not exists (
    select 1 from public.disponibilidad d
    where d.estudio_id = _e.id and d.user_id = _user and d.dia_semana = extract(dow from _local)::int
      and d.hora_inicio <= _local::time and d.hora_fin >= (_fin at time zone 'America/Lima')::time
  ) then raise exception 'Ese horario no está disponible'; end if;
  if exists (
    select 1 from public.eventos ev where ev.estudio_id = _e.id and ev.responsable_id = _user
      and ev.inicio < _fin and coalesce(ev.fin, ev.inicio + interval '1 hour') > _inicio
  ) or exists (
    select 1 from public.citas c where c.estudio_id = _e.id and c.user_id = _user and c.estado <> 'cancelada'
      and c.inicio < _fin and c.fin > _inicio
  ) then raise exception 'Ese horario acaba de ser tomado, elija otro'; end if;

  insert into public.eventos (estudio_id, titulo, tipo, inicio, fin, modalidad, responsable_id, notas, created_by)
  values (_e.id, 'Cita: ' || trim(_nombre), 'reunion', _inicio, _fin, 'presencial', _user,
    concat_ws(E'\n', 'Reservada desde la agenda en línea', nullif(trim(_email), ''), nullif(trim(_telefono), ''), nullif(trim(_motivo), '')), _user)
  returning id into _ev;
  insert into public.citas (estudio_id, user_id, nombre, email, telefono, motivo, inicio, fin, evento_id)
  values (_e.id, _user, trim(_nombre), nullif(trim(_email), ''), nullif(trim(_telefono), ''), nullif(trim(_motivo), ''), _inicio, _fin, _ev)
  returning id into _id;
  perform public.notificar_estudio(_e.id, _user, 'cita', 'Nueva cita reservada: ' || trim(_nombre),
    to_char(_local, 'DD/MM/YYYY HH24:MI') || coalesce(' · ' || nullif(trim(_motivo), ''), ''), '/calendario');
  return _id;
end; $$;
revoke execute on function public.reservar_cita(text, uuid, timestamptz, text, text, text, text) from public;
grant execute on function public.reservar_cita(text, uuid, timestamptz, text, text, text, text) to anon, authenticated;

-- ===== 10. Avisos derivados (sin tareas programadas) =====
create or replace function public.mis_avisos(_estudio uuid)
returns table (clave text, tipo text, titulo text, detalle text, enlace text, fecha timestamptz)
language sql stable security invoker set search_path = public as $$
  with hoy as (select (now() at time zone 'America/Lima')::date as d),
  avisos as (
    -- event reminders whose window has started
    select 'evento:' || ev.id as clave, 'evento'::text as tipo, ev.titulo,
      to_char(ev.inicio at time zone 'America/Lima', 'DD/MM HH24:MI') || coalesce(' · ' || ev.lugar, '') as detalle,
      '/calendario'::text as enlace, ev.inicio as fecha
    from public.eventos ev join public.estudios e on e.id = ev.estudio_id
    where ev.estudio_id = _estudio and ev.inicio > now()
      and coalesce(ev.responsable_id, ev.created_by) = auth.uid()
      and now() >= ev.inicio - make_interval(mins => coalesce(
        (select max(x) from unnest(ev.recordatorios) x),
        (select max(v::int) from jsonb_array_elements_text(coalesce(e.recordatorios_evento -> ev.tipo, '[]'::jsonb)) v),
        0))
    union all
    -- deadlines due tomorrow, today or overdue
    select 'plazo:' || p.id || ':' || p.fecha_vencimiento, 'plazo', p.titulo,
      case when p.fecha_vencimiento < (select d from hoy) then 'Vencido el ' || to_char(p.fecha_vencimiento, 'DD/MM/YYYY')
           when p.fecha_vencimiento = (select d from hoy) then 'Vence hoy' else 'Vence mañana' end,
      coalesce('/expedientes/' || p.expediente_id, '/plazos'), p.fecha_vencimiento::timestamptz
    from public.plazos p
    where p.estudio_id = _estudio and p.estado = 'pendiente'
      and coalesce(p.asignado_a, p.created_by) = auth.uid()
      and p.fecha_vencimiento <= (select d from hoy) + 1
    union all
    -- overdue unpaid installments (RLS limits to lawyers/admins)
    select 'cuota:' || q.id, 'cuota', 'Cuota ' || q.numero || ' vencida: ' || h.concepto,
      'Venció el ' || to_char(q.fecha_vencimiento, 'DD/MM/YYYY'), '/finanzas', q.fecha_vencimiento::timestamptz
    from (
      select c.*, sum(c.monto) over (partition by c.honorario_id order by c.numero, c.fecha_vencimiento) as acumulado
      from public.cuotas c where c.estudio_id = _estudio
    ) q join public.honorarios h on h.id = q.honorario_id
    where q.fecha_vencimiento < (select d from hoy)
      and q.acumulado > (select coalesce(sum(pg.monto), 0) from public.pagos pg where pg.honorario_id = q.honorario_id)
    union all
    select 'notif:' || n.id, n.tipo, n.titulo, n.detalle, n.enlace, n.created_at
    from public.notificaciones n where n.estudio_id = _estudio and n.user_id = auth.uid()
  )
  select a.* from avisos a
  where not exists (select 1 from public.avisos_descartados ad where ad.user_id = auth.uid() and ad.clave = a.clave)
  order by a.fecha desc
  limit 100
$$;
revoke execute on function public.mis_avisos(uuid) from public, anon;
grant execute on function public.mis_avisos(uuid) to authenticated;

-- audit for new business tables
create trigger auditoria_mensajes_cliente after insert or update or delete on public.mensajes_cliente for each row execute function public.registrar_auditoria();
create trigger auditoria_portal_accesos after insert or update or delete on public.portal_accesos for each row execute function public.registrar_auditoria();
create trigger auditoria_citas after insert or update or delete on public.citas for each row execute function public.registrar_auditoria();
