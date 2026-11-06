import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/demo-db/client";
import type { Database } from "@/lib/demo-db/types";

export type Documento = Database["public"]["Tables"]["documentos"]["Row"];

export const familiaDocumento = (d: Documento) => d.documento_origen ?? d.id;

export function ultimasVersiones(documentos: Documento[]) {
  const familias = new Map<string, Documento>();
  for (const d of documentos) {
    const key = familiaDocumento(d);
    const anterior = familias.get(key);
    if (
      !anterior ||
      d.version > anterior.version ||
      (d.version === anterior.version && d.created_at > anterior.created_at)
    ) {
      familias.set(key, d);
    }
  }
  return [...familias.values()];
}

export const enlacesDocumentoQuery = (estudioId: string, documentoId: string) =>
  queryOptions({
    queryKey: ["enlaces-documento", estudioId, documentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enlaces_documento")
        .select("*")
        .eq("estudio_id", estudioId)
        .eq("documento_id", documentoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
