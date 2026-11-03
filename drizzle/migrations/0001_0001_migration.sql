create or replace function public.registrar_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare _row jsonb; _resumen text; _estudio uuid;
begin
  _row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  _estudio := (_row->>'estudio_id')::uuid;
  -- Skip when the whole studio is being removed (cascade delete)
  if not exists (select 1 from public.estudios where id = _estudio) then
    return null;
  end if;
  _resumen := coalesce(_row->>'titulo', _row->>'concepto', _row->>'nombre', _row->>'razon_social',
    nullif(trim(coalesce(_row->>'nombres','') || ' ' || coalesce(_row->>'apellidos','')), ''), _row->>'descripcion');
  insert into public.auditoria (estudio_id, tabla, registro_id, accion, user_id, resumen)
  values (_estudio, tg_table_name, (_row->>'id')::uuid, lower(tg_op), auth.uid(), left(_resumen, 200));
  return null;
end; $$;

comment on table public.estudios is 'Estudios jurídicos (tenants)';