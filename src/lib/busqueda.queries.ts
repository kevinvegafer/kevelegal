import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/demo-db/client";
import { ultimasVersiones, type Documento } from "@/lib/documentos.queries";

// Claves bajo "documentos" y "partes": las invalidaciones por prefijo existentes también las refrescan.
export const documentosEstudioQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["documentos", "estudio", estudioId],
    queryFn: async () => {
      const { data, error } = await supabase.from("documentos").select("*").eq("estudio_id", estudioId);
      if (error) throw new Error(error.message);
      return ultimasVersiones((data ?? []) as Documento[]);
    },
  });

export const partesEstudioQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["partes", "estudio", estudioId],
    queryFn: async () => {
      const { data, error } = await supabase.from("partes_procesales").select("*").eq("estudio_id", estudioId);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
