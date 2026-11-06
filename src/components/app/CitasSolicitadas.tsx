import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/demo-db/client';
import { useEstudio } from '@/hooks/use-estudio';
import { citasQuery } from '@/lib/queries-agenda';
import { formatoLima } from '@/lib/agenda';
import { mensajeError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/app/ui';
export function CitasSolicitadas() {
  const { estudioId, puedeEliminar } = useEstudio();
  const qc = useQueryClient();
  const consulta = useQuery(citasQuery(estudioId));
  const cambiar = useMutation({
    mutationFn: async ({ id, estado, eventoId }: { id: string; estado: 'confirmada' | 'cancelada'; eventoId: string | null }) => {
      // Delete first: a failed deletion must not hide an active calendar event behind a cancelled appointment.
      // The FK sets evento_id to null; if the next request fails, the visible appointment can be retried.
      if (estado === 'cancelada' && eventoId) {
        const { data, error } = await supabase.from('eventos').delete().eq('estudio_id',estudioId).eq('id',eventoId).select('id');
        if (error) throw error;
        if (!data.length) throw new Error('No se pudo eliminar el evento vinculado. Revisa tus permisos y vuelve a intentar.');
      }
      const { data, error } = await supabase.from('citas').update({ estado }).eq('estudio_id',estudioId).eq('id',id).select('id');
      if (error) throw error;
      if (!data.length) throw new Error('No se pudo actualizar la cita');
    },
    onSuccess: () => toast.success('Cita actualizada'),
    onError: e => toast.error(mensajeError(e)),
    onSettled: async () => { await Promise.all(['citas','eventos','agenda-publica'].map(key => qc.invalidateQueries({ queryKey: [key] }))); },
  });
  return <Panel title="Citas solicitadas">
    {consulta.isPending && <p role="status">Cargando citas…</p>}
    {consulta.isError && <div role="alert"><p>No se pudieron cargar las citas.</p><Button onClick={() => void consulta.refetch()}>Reintentar</Button></div>}
    {consulta.data?.length === 0 && <p className="text-muted-foreground">No hay citas próximas.</p>}
    <div className="grid gap-4">{consulta.data?.map(c => {
      const digits = c.telefono?.replace(/\D/g,'') ?? '';
      const whatsapp = digits.length === 9 ? `51${digits}` : digits.length === 11 && digits.startsWith('51') ? digits : '';
      return <article key={c.id} className="grid gap-2 rounded-lg border border-border p-4">
        <h3 className="font-medium">{c.nombre}</h3><p className="text-sm">{formatoLima(c.inicio)}</p><p className="text-sm text-muted-foreground">{c.estado === 'pendiente' ? 'Pendiente de confirmación' : 'Confirmada'}</p>
        {c.motivo && <p className="whitespace-pre-wrap break-words text-sm">{c.motivo}</p>}
        <div className="flex flex-wrap gap-3 text-sm">{c.email && <a className="text-primary underline" href={`mailto:${c.email}`}>{c.email}</a>}{c.telefono && (whatsapp ? <a className="text-primary underline" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">WhatsApp · {c.telefono}</a> : <span>{c.telefono}</span>)}</div>
        <div className="flex flex-wrap gap-2">{c.estado === 'pendiente' && <Button size="sm" disabled={cambiar.isPending} onClick={() => cambiar.mutate({ id:c.id, estado:'confirmada', eventoId:c.evento_id })}>Confirmar</Button>}
        {puedeEliminar && <Button size="sm" variant="outline" disabled={cambiar.isPending} onClick={() => { if (window.confirm('¿Cancelar la cita y eliminar su evento del calendario?')) cambiar.mutate({ id:c.id, estado:'cancelada', eventoId:c.evento_id }); }}>Cancelar</Button>}</div>
      </article>;
    })}</div>
  </Panel>;
}
