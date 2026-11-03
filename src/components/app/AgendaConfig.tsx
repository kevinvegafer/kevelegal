import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from '@tanstack/react-router';
import { useEstudio } from '@/hooks/use-estudio';
import { supabase } from '@/integrations/supabase/client';
import { disponibilidadQuery } from '@/lib/queries-agenda';
import { miembrosQuery } from '@/lib/queries';
import { mensajeError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, NativeSelect, Panel } from '@/components/app/ui';
import { OPCIONES_RECORDATORIO, etiquetaRecordatorio, valoresRecordatorio } from './RecordatoriosSelect';
const TIPOS = [ ['audiencia','Audiencia'], ['informe_oral','Informe oral'], ['diligencia','Diligencia'], ['reunion','Reunión'], ['otro','Otro'] ] as const;
const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
export function AgendaConfig() {
  const { estudio, esAdmin, estudioId, user } = useEstudio();
  const qc = useQueryClient();
  const router = useRouter();
  const [miembro, setMiembro] = useState(user.id);
  const miembros = useQuery(miembrosQuery(estudioId));
  const guardar = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      if (!esAdmin) throw new Error('Solo un administrador puede editar estos datos');
      const fd = new FormData(form);
      const slug = String(fd.get('agenda_slug') ?? '').trim();
      const activa = fd.get('agenda_activa') === 'on';
      if ((slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) || slug.length > 100 || (activa && !slug)) throw new Error('Usa un enlace de hasta 100 caracteres: letras minúsculas, números y guiones entre palabras');
      const duracion = Number(fd.get('agenda_duracion_min'));
      const anticipacion = Number(fd.get('agenda_anticipacion_horas'));
      const tarifa = Number(fd.get('tarifa_hora'));
      if (!Number.isInteger(duracion) || duracion < 10 || duracion > 240 || !Number.isInteger(anticipacion) || anticipacion < 0 || anticipacion > 720 || !Number.isFinite(tarifa) || tarifa < 0) throw new Error('Revisa duración, anticipación y tarifa');
      const recordatorios: Record<string, number[]> = Object.fromEntries(TIPOS.map(([tipo]) => [tipo, fd.getAll(`recordatorio_${tipo}`).map(Number)]));
      const { data, error } = await supabase.from('estudios').update({ agenda_slug: slug || null, agenda_activa: activa,
        agenda_duracion_min: duracion, agenda_anticipacion_horas: anticipacion, tarifa_hora: tarifa, recordatorios_evento: recordatorios,
      }).eq('id',estudioId).select('id');
      if (error) throw error;
      if (!data.length) throw new Error('No se pudo guardar la configuración');
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['membresias'] }); await router.invalidate(); void qc.invalidateQueries({ queryKey: ['agenda-publica'] }); toast.success('Configuración de agenda guardada'); },
    onError: e => toast.error(mensajeError(e)),
  });
  return <div className="grid gap-6 lg:col-span-2">
    <form className="grid gap-6 lg:grid-cols-2" key={`${estudio.agenda_slug}-${estudio.agenda_activa}-${estudio.agenda_duracion_min}-${estudio.agenda_anticipacion_horas}-${estudio.tarifa_hora}-${JSON.stringify(estudio.recordatorios_evento)}`} onSubmit={e => { e.preventDefault(); guardar.mutate(e.currentTarget); }}>
      <Panel title="Agenda en línea"><fieldset disabled={!esAdmin || guardar.isPending} className="grid gap-4">
        <label className="flex items-center gap-2"><input type="checkbox" name="agenda_activa" defaultChecked={estudio.agenda_activa} /> Activar reservas públicas</label>
        <Field label="Enlace público (slug)" htmlFor="agenda-slug" hint="Solo minúsculas, números y guiones entre palabras."><Input id="agenda-slug" name="agenda_slug" defaultValue={estudio.agenda_slug ?? ''} maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></Field>
        <Field label="Duración de la cita (minutos)" htmlFor="agenda-duracion"><Input id="agenda-duracion" name="agenda_duracion_min" type="number" min={10} max={240} step={1} required defaultValue={estudio.agenda_duracion_min} /></Field>
        <Field label="Anticipación mínima (horas)" htmlFor="agenda-anticipacion"><Input id="agenda-anticipacion" name="agenda_anticipacion_horas" type="number" min={0} max={720} step={1} required defaultValue={estudio.agenda_anticipacion_horas} /></Field>
        <Field label="Tarifa por hora por defecto (S/)" htmlFor="agenda-tarifa"><Input id="agenda-tarifa" name="tarifa_hora" type="number" min={0} step="0.01" required defaultValue={estudio.tarifa_hora} /></Field>
      </fieldset>
      {estudio.agenda_slug && <EnlacePublico slug={estudio.agenda_slug} />}
      {!esAdmin && <p className="mt-3 text-xs text-muted-foreground">Solo un administrador puede editar estos datos.</p>}
      </Panel>
      <Panel title="Recordatorios por defecto"><fieldset disabled={!esAdmin || guardar.isPending} className="grid gap-4">{TIPOS.map(([tipo,label]) => <div key={tipo}><p className="mb-2 text-sm font-medium">{label}</p><div className="flex flex-wrap gap-2">{OPCIONES_RECORDATORIO.map(n => <label key={n} className="cursor-pointer rounded-full border border-border px-3 py-1 text-sm has-[:checked]:bg-accent has-[:checked]:text-accent-foreground"><input type="checkbox" name={`recordatorio_${tipo}`} value={n} className="mr-1 accent-primary" defaultChecked={valoresRecordatorio(estudio.recordatorios_evento,tipo).includes(n)} />{etiquetaRecordatorio(n)}</label>)}</div></div>)}</fieldset><p className="mt-3 text-xs text-muted-foreground">Sin opciones seleccionadas: sin recordatorios para ese tipo de evento.</p></Panel>
      {esAdmin && <div className="lg:col-span-2"><Button type="submit" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar agenda y recordatorios'}</Button></div>}
    </form>
    <Panel title="Mi disponibilidad">
      <p className="mb-4 text-sm text-muted-foreground">Horario semanal de Perú (UTC−5). Puedes añadir varias franjas por día. Los feriados nacionales no se ofrecen para reservas.</p>
      {esAdmin && <Field label="Miembro"><NativeSelect value={miembro} onChange={e => setMiembro(e.target.value)}><option value={user.id}>Mi disponibilidad</option>{miembros.data?.filter(m => m.user_id !== user.id).map(m => <option key={m.user_id} value={m.user_id}>{m.perfil?.nombre_completo || m.perfil?.email || m.user_id}</option>)}</NativeSelect></Field>}
      {miembros.isError && <p role="alert">No se pudo cargar la lista de miembros.</p>}
      <DisponibilidadEditor key={`${estudioId}-${esAdmin ? miembro : user.id}`} userId={esAdmin ? miembro : user.id} />
    </Panel>
  </div>;
}
function EnlacePublico({ slug }: { slug: string }) {
  const path = `/agenda/${slug}`;
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return <div className="mt-4 flex flex-wrap items-center gap-3"><a className="break-all text-sm text-primary underline" href={path} target="_blank" rel="noreferrer">{origin}{path}</a><Button type="button" size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}${path}`).then(() => toast.success('Enlace copiado')).catch(() => toast.error('No se pudo copiar el enlace')); }}>Copiar enlace</Button></div>;
}
function DisponibilidadEditor({ userId }: { userId: string }) {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  const consulta = useQuery(disponibilidadQuery(estudioId,userId));
  const mutation = useMutation({
    mutationFn: async (accion: { borrar: string } | { form: HTMLFormElement }) => {
      if ('borrar' in accion) {
        const { data, error } = await supabase.from('disponibilidad').delete().eq('id',accion.borrar).eq('estudio_id',estudioId).eq('user_id',userId).select('id');
        if (error) throw error;
        if (!data.length) throw new Error('No se pudo eliminar la franja');
      } else {
        const fd = new FormData(accion.form);
        const dia = Number(fd.get('dia'));
        const desde = String(fd.get('desde') ?? '');
        const hasta = String(fd.get('hasta') ?? '');
        if (!Number.isInteger(dia) || dia < 0 || dia > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(desde) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hasta) || desde >= hasta) throw new Error('La hora final debe ser posterior a la inicial');
        if (consulta.data?.some(f => f.dia_semana === dia && f.hora_inicio.slice(0,5) < hasta && f.hora_fin.slice(0,5) > desde)) throw new Error('La franja se superpone con otra existente');
        const { error } = await supabase.from('disponibilidad').insert({ estudio_id:estudioId, user_id:userId, dia_semana:dia, hora_inicio:desde, hora_fin:hasta });
        if (error) throw error;
      }
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey:['disponibilidad',estudioId,userId] }); void qc.invalidateQueries({ queryKey:['agenda-publica'] }); toast.success('Disponibilidad actualizada'); },
    onError: e => toast.error(mensajeError(e)),
  });
  return <div className="mt-4 grid gap-4">
    {consulta.isPending && <p role="status">Cargando disponibilidad…</p>}
    {consulta.isError && <div role="alert">No se pudo cargar la disponibilidad. <Button onClick={() => void consulta.refetch()}>Reintentar</Button></div>}
    {consulta.data?.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay franjas. Añade la primera para recibir reservas.</p>}
    <ul className="grid gap-2">{consulta.data?.map(f => <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"><span>{DIAS[f.dia_semana]} · {f.hora_inicio.slice(0,5)}–{f.hora_fin.slice(0,5)}</span><Button type="button" size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ borrar:f.id })} aria-label={`Eliminar franja del ${DIAS[f.dia_semana]} a las ${f.hora_inicio.slice(0,5)}`}>Eliminar</Button></li>)}</ul>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); mutation.mutate({ form:e.currentTarget }); }}>
      <Field label="Día"><NativeSelect name="dia" defaultValue="1">{DIAS.map((d,i) => <option key={d} value={i}>{d}</option>)}</NativeSelect></Field>
      <Field label="Desde"><Input type="time" name="desde" required defaultValue="09:00" /></Field><Field label="Hasta"><Input type="time" name="hasta" required defaultValue="18:00" /></Field>
      <Button type="submit" disabled={mutation.isPending || !consulta.isSuccess}>Añadir franja</Button>
    </form>
  </div>;
}
