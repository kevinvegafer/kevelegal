create table public.plantillas (
  id uuid primary key default gen_random_uuid(),
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  nombre text not null,
  descripcion text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.plantillas to authenticated;
grant all on public.plantillas to service_role;
alter table public.plantillas enable row level security;
create policy "miembros leen" on public.plantillas for select to authenticated using (public.es_miembro(estudio_id));
create policy "miembros crean" on public.plantillas for insert to authenticated with check (public.es_miembro(estudio_id));
create policy "miembros editan" on public.plantillas for update to authenticated using (public.es_miembro(estudio_id)) with check (public.es_miembro(estudio_id));
create policy "abogados y admin eliminan" on public.plantillas for delete to authenticated using (public.tiene_rol(estudio_id, 'admin'::rol_estudio) or public.tiene_rol(estudio_id, 'abogado'::rol_estudio));

create table public.plantilla_items (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.plantillas(id) on delete cascade,
  estudio_id uuid not null references public.estudios(id) on delete cascade,
  tipo text not null default 'tarea',
  titulo text not null,
  descripcion text,
  dias integer not null default 0,
  dias_habiles boolean not null default false,
  prioridad text not null default 'media',
  tipo_evento text not null default 'otro',
  hora text not null default '09:00',
  duracion_minutos integer not null default 60,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.plantilla_items to authenticated;
grant all on public.plantilla_items to service_role;
alter table public.plantilla_items enable row level security;
create policy "miembros leen" on public.plantilla_items for select to authenticated using (public.es_miembro(estudio_id));
create policy "miembros crean" on public.plantilla_items for insert to authenticated with check (public.es_miembro(estudio_id));
create policy "miembros editan" on public.plantilla_items for update to authenticated using (public.es_miembro(estudio_id)) with check (public.es_miembro(estudio_id));
create policy "abogados y admin eliminan" on public.plantilla_items for delete to authenticated using (public.tiene_rol(estudio_id, 'admin'::rol_estudio) or public.tiene_rol(estudio_id, 'abogado'::rol_estudio));

create trigger touch_plantillas before update on public.plantillas for each row execute function public.touch_updated_at();
create trigger auditoria_plantillas after insert or update or delete on public.plantillas for each row execute function public.registrar_auditoria();
create trigger auditoria_plantilla_items after insert or update or delete on public.plantilla_items for each row execute function public.registrar_auditoria();

create or replace function public.aplicar_plantilla(_plantilla uuid, _expediente uuid, _items jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare _estudio uuid; _n int := 0; _it jsonb;
begin
  select estudio_id into _estudio from public.plantillas where id = _plantilla;
  if _estudio is null then raise exception 'Plantilla no encontrada'; end if;
  if not public.es_miembro(_estudio) then raise exception 'No autorizado'; end if;
  if not exists (select 1 from public.expedientes where id = _expediente and estudio_id = _estudio) then
    raise exception 'El expediente no pertenece a este estudio';
  end if;
  for _it in select value from jsonb_array_elements(_items) loop
    if _it->>'tipo' = 'evento' then
      insert into public.eventos (estudio_id, expediente_id, titulo, tipo, inicio, fin, modalidad, notas, created_by)
      values (_estudio, _expediente, _it->>'titulo', coalesce(nullif(_it->>'tipo_evento', ''), 'otro'),
              (_it->>'inicio')::timestamptz, (_it->>'fin')::timestamptz, 'presencial', nullif(_it->>'descripcion', ''), auth.uid());
    else
      insert into public.plazos (estudio_id, expediente_id, titulo, tipo, fecha_notificacion, dias_habiles, fecha_vencimiento, prioridad, estado, notas, created_by)
      values (_estudio, _expediente, _it->>'titulo', 'tarea',
              (_it->>'fecha_base')::date,
              case when coalesce((_it->>'dias_habiles')::boolean, false) then (_it->>'dias')::int end,
              (_it->>'fecha_vencimiento')::date,
              coalesce(nullif(_it->>'prioridad', ''), 'media'), 'pendiente', nullif(_it->>'descripcion', ''), auth.uid());
    end if;
    _n := _n + 1;
  end loop;
  return _n;
end $$;
grant execute on function public.aplicar_plantilla(uuid, uuid, jsonb) to authenticated;