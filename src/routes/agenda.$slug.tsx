import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { agendaPublicaQuery } from '@/lib/queries-agenda';
import { generarHorarios, formatoLima, fechaLima } from '@/lib/agenda';
import { feriadosNacionales } from '@/lib/peru';
import { mensajeError } from '@/lib/errors';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, NativeSelect, Panel } from '@/components/app/ui';
export const Route = createFileRoute('/agenda/$slug')({
  head: () => ({ meta: [
    { title: 'Reservar una cita — Kevelegal' },
    { name: 'description', content: 'Elige un horario y solicita una cita con tu estudio jurídico.' },
    { property: 'og:title', content: 'Agenda en línea — Kevelegal' },
    { property: 'og:description', content: 'Reserva una consulta jurídica en un horario disponible.' },
  ] }), component: AgendaPublica,
});
function AgendaPublica() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const consulta = useQuery(agendaPublicaQuery(slug));
  const [abogadoId, setAbogadoId] = useState('');
  const [dia, setDia] = useState('');
  const [hora, setHora] = useState('');
  const [exito, setExito] = useState('');
  const [ahora, setAhora] = useState(() => new Date());
  const datos = consulta.data;
  const abogado = datos?.abogados.find(a => a.id === abogadoId) ?? datos?.abogados[0];
  const year = Number(fechaLima(ahora).slice(0,4));
  const dias = datos && abogado ? generarHorarios({ franjas: abogado.franjas,
    ocupado: datos.ocupado.filter(o => o.user_id === abogado.id), duracionMin: datos.duracion,
    anticipacionHoras: datos.anticipacion_horas, desde: ahora, dias: 30,
    feriados: [year,year+1].flatMap(y => feriadosNacionales(y).map(f => f.fecha)),
  }) : [];
  const seleccionado = dias.find(d => d.fecha === dia);
  const valido = !!seleccionado?.horarios.includes(hora);
  const reservar = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      if (!valido || !abogado) throw new Error('Elija un horario disponible');
      const fd = new FormData(form);
      const texto = (key: string) => String(fd.get(key) ?? '').trim();
      const { error } = await supabase.rpc('reservar_cita', { _slug: slug, _user: abogado.id, _inicio: hora,
        _nombre: texto('nombre'), _email: texto('email'), _telefono: texto('telefono'), _motivo: texto('motivo') });
      if (error) throw error;
      return hora;
    },
    onSuccess: (inicio) => { setExito(inicio); void qc.invalidateQueries({ queryKey: ['agenda-publica',slug] }); },
    onError: (e) => { toast.error(mensajeError(e)); setHora(''); setAhora(new Date()); void consulta.refetch(); },
  });
  return <main className="min-h-screen bg-background px-4 py-10 text-foreground"><div className="mx-auto grid max-w-2xl gap-6">
    <header><p className="text-sm text-primary">Kevelegal · Agenda en línea</p><h1 className="mt-2 font-display text-3xl">{datos?.nombre ?? 'Reserva una cita'}</h1><p className="mt-2 text-muted-foreground">Horarios de Perú · America/Lima (UTC−5)</p></header>
    {exito ? <Panel title="Solicitud de cita registrada"><p role="status">{formatoLima(exito)} · {datos?.duracion} minutos.</p><p className="mt-3 text-muted-foreground">El estudio recibió tu solicitud y se pondrá en contacto contigo para confirmarla.</p></Panel>
      : consulta.isPending ? <p role="status">Cargando horarios…</p>
      : consulta.isError || !datos ? <Panel title="Agenda no disponible"><p>No se puede consultar esta agenda. Comprueba el enlace o vuelve a intentarlo.</p><Button className="mt-4" onClick={() => void consulta.refetch()}>Reintentar</Button></Panel>
      : <Panel title="Elige tu consulta"><form className="grid gap-5" onSubmit={e => { e.preventDefault(); reservar.mutate(e.currentTarget); }}>
        <fieldset disabled={reservar.isPending} className="grid gap-5">
        {datos.abogados.length > 1 && <Field label="Profesional"><NativeSelect value={abogado?.id ?? ''} onChange={e => { setAbogadoId(e.target.value); setDia(''); setHora(''); }}>{datos.abogados.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</NativeSelect></Field>}
        {datos.abogados.length === 1 && <p className="text-muted-foreground">Con {abogado?.nombre}</p>}
        {!dias.length ? <p role="status">No hay horarios disponibles en los próximos 30 días.</p> : <>
          <Field label="Día disponible"><NativeSelect value={dia} onChange={e => { setDia(e.target.value); setHora(''); }} required><option value="">Selecciona un día</option>{dias.map(d => <option key={d.fecha} value={d.fecha}>{new Intl.DateTimeFormat('es-PE', { timeZone:'America/Lima', weekday:'long',day:'numeric',month:'long' }).format(new Date(`${d.fecha}T12:00:00-05:00`))}</option>)}</NativeSelect></Field>
          {seleccionado && <div role="group" aria-label="Horarios disponibles" className="flex flex-wrap gap-2">{seleccionado.horarios.map(h => <Button key={h} type="button" variant={hora === h ? 'default' : 'outline'} aria-pressed={hora === h} onClick={() => setHora(h)}>{formatoLima(h,true)}</Button>)}</div>}
          {valido && <div className="grid gap-4 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">{formatoLima(hora)} · {datos.duracion} min</p>
            <Field label="Nombre completo" htmlFor="cita-nombre"><Input id="cita-nombre" name="nombre" autoComplete="name" required maxLength={200} /></Field>
            <Field label="Correo electrónico" htmlFor="cita-email"><Input id="cita-email" name="email" type="email" autoComplete="email" required maxLength={254} /></Field>
            <Field label="Teléfono" htmlFor="cita-telefono"><Input id="cita-telefono" name="telefono" type="tel" autoComplete="tel" required maxLength={30} /></Field>
            <Field label="Motivo de consulta" htmlFor="cita-motivo"><textarea id="cita-motivo" name="motivo" maxLength={2000} rows={3} className="w-full rounded-md border border-border bg-background p-3" /></Field>
          </div>}
          <Button type="submit" disabled={!valido || reservar.isPending}>{reservar.isPending ? 'Enviando…' : 'Confirmar solicitud'}</Button>
        </>}
        </fieldset>
      </form></Panel>}
  </div></main>;
}
