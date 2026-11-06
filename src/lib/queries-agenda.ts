import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/lib/demo-db/client';
const agendaSchema = z.object({
  nombre: z.string(), duracion: z.number(), anticipacion_horas: z.number(),
  abogados: z.array(z.object({ id: z.string(), nombre: z.string(), franjas: z.array(z.object({ dia: z.number(), desde: z.string(), hasta: z.string() })) })),
  ocupado: z.array(z.object({ user_id: z.string(), inicio: z.string(), fin: z.string() })),
});
export const agendaPublicaQuery = (slug: string) => queryOptions({
  queryKey: ['agenda-publica', slug], staleTime: 0, refetchInterval: 60_000, retry: false,
  queryFn: async () => {
    const { data, error } = await supabase.rpc('agenda_publica', { _slug: slug });
    if (error) throw error;
    return data === null ? null : agendaSchema.parse(data);
  },
});
export const disponibilidadQuery = (estudioId: string, userId: string) => queryOptions({
  queryKey: ['disponibilidad', estudioId, userId],
  queryFn: async () => {
    const { data, error } = await supabase.from('disponibilidad').select('*').eq('estudio_id', estudioId).eq('user_id', userId).order('dia_semana').order('hora_inicio');
    if (error) throw error;
    return data;
  },
});
export const citasQuery = (estudioId: string) => queryOptions({
  queryKey: ['citas', estudioId], refetchInterval: 60_000,
  queryFn: async () => {
    const { data, error } = await supabase.from('citas').select('*').eq('estudio_id', estudioId).in('estado', ['pendiente','confirmada']).gte('fin', new Date().toISOString()).order('inicio');
    if (error) throw error;
    return data;
  },
});
