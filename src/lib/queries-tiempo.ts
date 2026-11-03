import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
export type RegistroTiempo = Tables<"registros_tiempo">;
export const tiempoQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["tiempo", estudioId],
    refetchInterval: 15000,
    queryFn: async () => {
      const rows: RegistroTiempo[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from("registros_tiempo")
          .select("*")
          .eq("estudio_id", estudioId)
          .order("id")
          .range(offset, offset + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) return rows;
      }
    },
  });
export const cuotasQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["cuotas", estudioId],
    queryFn: async () => {
      const rows: Tables<"cuotas">[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from("cuotas")
          .select("*")
          .eq("estudio_id", estudioId)
          .order("id")
          .range(offset, offset + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) return rows;
      }
    },
  });
export function segundosActuales(r: RegistroTiempo, ahora = Date.now()) {
  return (
    r.segundos +
    (r.en_curso && r.ultimo_inicio
      ? Math.max(0, Math.floor((ahora - Date.parse(r.ultimo_inicio)) / 1000))
      : 0)
  );
}
