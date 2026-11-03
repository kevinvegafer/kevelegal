import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const nullableText = z.string().nullable();
const numeric = z.union([z.number(), z.string()]).transform(Number);

export const portalSchema = z.object({
  estudio: z.object({
    nombre: z.string(),
    telefono: nullableText,
    email: nullableText,
  }),
  cliente: z.object({ nombre: z.string() }),
  expedientes: z.array(z.object({
    id: z.string(),
    titulo: z.string(),
    numero: nullableText,
    estado: z.string(),
    materia: z.string(),
    fase: nullableText,
    fase_desde: nullableText,
    fases: z.array(z.string()),
    proximos: z.array(z.object({
      titulo: z.string(),
      inicio: z.string(),
      tipo: z.string(),
      modalidad: nullableText,
    })),
  })),
  documentos: z.array(z.object({
    id: z.string(),
    nombre: z.string(),
    expediente_id: nullableText,
    created_at: z.string(),
    tamano: numeric.nullable(),
    mime_type: nullableText,
    subido_por_cliente: z.boolean(),
  })),
  mensajes: z.array(z.object({
    id: z.string(),
    autor: z.enum(["estudio", "cliente"]),
    cuerpo: z.string(),
    created_at: z.string(),
    expediente_id: nullableText,
  })),
  cuenta: z.array(z.object({
    concepto: z.string(),
    moneda: z.string(),
    total: numeric,
    pagado: numeric,
    cuotas: z.array(z.object({
      numero: z.number(),
      monto: numeric,
      vence: z.string(),
    })),
  })),
});

export type PortalDatos = z.infer<typeof portalSchema>;

export const portalDatosQuery = (token: string) =>
  queryOptions({
    queryKey: ["portal-datos", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("portal_datos", {
        _token: token,
      });
      if (error) throw error;
      return portalSchema.parse(data);
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
  });

export const portalAccesosQuery = (estudioId: string, clienteId: string) =>
  queryOptions({
    queryKey: ["portal-accesos", estudioId, clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("portal_accesos")
        .select("*")
        .eq("estudio_id", estudioId)
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const mensajesClienteQuery = (
  estudioId: string,
  clienteId?: string,
) =>
  queryOptions({
    queryKey: ["mensajes-cliente", estudioId, clienteId ?? "todos"],
    queryFn: async () => {
      let query = supabase.from("mensajes_cliente")
        .select("*")
        .eq("estudio_id", estudioId)
        .order("created_at", { ascending: true });
      if (clienteId) query = query.eq("cliente_id", clienteId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 20_000,
  });
