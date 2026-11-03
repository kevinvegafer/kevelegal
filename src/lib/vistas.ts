import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type FiltrosExpedientes = { q: string; estado: string; materia: string; mios: boolean };

export const vistasGuardadasQuery = (estudioId: string, modulo: "expedientes" | "clientes" | "plazos") =>
  queryOptions({
    queryKey: ["vistas", estudioId, modulo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vistas_guardadas")
        .select("*")
        .eq("estudio_id", estudioId)
        .eq("modulo", modulo)
        .order("nombre");
      if (error) throw new Error(error.message);
      return data;
    },
  });

/** Reads stored filters defensively: unknown keys/types fall back to "no filter". */
export function leerFiltrosExpedientes(raw: Json): FiltrosExpedientes {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const txt = (k: string) => {
    const v = (o as Record<string, Json | undefined>)[k];
    return typeof v === "string" ? v : "";
  };
  return { q: txt("q"), estado: txt("estado"), materia: txt("materia"), mios: (o as Record<string, Json | undefined>)["mios"] === true };
}
