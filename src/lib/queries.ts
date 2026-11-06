import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/demo-db/client";
import type { Tables } from "@/lib/demo-db/types";

export type Estudio = Tables<"estudios">;
export type Cliente = Tables<"clientes">;
export type Expediente = Tables<"expedientes">;
export type Plazo = Tables<"plazos">;
export type Evento = Tables<"eventos">;
export type Honorario = Tables<"honorarios">;
export type Pago = Tables<"pagos">;
export type Gasto = Tables<"gastos">;
export type Documento = Tables<"documentos">;
export type Parte = Tables<"partes_procesales">;
export type Actuacion = Tables<"actuaciones">;
export type Profile = Tables<"profiles">;
export type Plantilla = Tables<"plantillas">;
export type PlantillaItem = Tables<"plantilla_items">;
export type Rol = "admin" | "abogado" | "asistente";

export type ClienteMini = Pick<Cliente, "id" | "nombres" | "apellidos" | "razon_social" | "tipo_persona">;

export function nombreCliente(c?: Partial<ClienteMini> | null) {
  if (!c) return "Sin cliente";
  if (c.tipo_persona === "juridica") return c.razon_social || "Sin nombre";
  return [c.nombres, c.apellidos].filter(Boolean).join(" ") || c.razon_social || "Sin nombre";
}

type Res = { data: unknown; error: { message: string } | null };

function check<R extends Res>(res: R): NonNullable<R["data"]> {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as NonNullable<R["data"]>;
}

function checkMaybe<R extends Res>(res: R): R["data"] {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export const membresiasQuery = () =>
  queryOptions({
    queryKey: ["membresias"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return [];
      const rows = check(
        await supabase
          .from("estudio_miembros")
          .select("rol, estudio:estudios(*)")
          .eq("user_id", auth.user.id),
      );
      return rows
        .filter((r) => r.estudio)
        .map((r) => ({ rol: r.rol as Rol, estudio: r.estudio as Estudio }));
    },
  });

export const perfilQuery = () =>
  queryOptions({
    queryKey: ["perfil"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      return checkMaybe(await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle());
    },
  });

export const invitacionesPendientesQuery = () =>
  queryOptions({
    queryKey: ["invitaciones-pendientes"],
    queryFn: async () => {
      const rows = check(
        await supabase
          .from("invitaciones")
          .select("id, rol, email, estudio_id, aceptada_at")
          .is("aceptada_at", null),
      );
      return rows;
    },
  });

export const clientesQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["clientes", estudioId],
    queryFn: async () =>
      check(
        await supabase
          .from("clientes")
          .select("*")
          .eq("estudio_id", estudioId)
          .order("created_at", { ascending: false }),
      ),
  });

export const clienteQuery = (id: string) =>
  queryOptions({
    queryKey: ["cliente", id],
    queryFn: async () => checkMaybe(await supabase.from("clientes").select("*").eq("id", id).maybeSingle()),
  });

const EXP_SELECT = "*, cliente:clientes(id, nombres, apellidos, razon_social, tipo_persona)";

export const expedientesQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["expedientes", estudioId],
    queryFn: async () =>
      check(
        await supabase
          .from("expedientes")
          .select(EXP_SELECT)
          .eq("estudio_id", estudioId)
          .order("updated_at", { ascending: false }),
      ),
  });

export const expedienteQuery = (id: string) =>
  queryOptions({
    queryKey: ["expediente", id],
    queryFn: async () =>
      checkMaybe(await supabase.from("expedientes").select(EXP_SELECT).eq("id", id).maybeSingle()),
  });

export const partesQuery = (expedienteId: string) =>
  queryOptions({
    queryKey: ["partes", expedienteId],
    queryFn: async () =>
      check(
        await supabase
          .from("partes_procesales")
          .select("*")
          .eq("expediente_id", expedienteId)
          .order("created_at"),
      ),
  });

export const actuacionesQuery = (expedienteId: string) =>
  queryOptions({
    queryKey: ["actuaciones", expedienteId],
    queryFn: async () =>
      check(
        await supabase
          .from("actuaciones")
          .select("*")
          .eq("expediente_id", expedienteId)
          .order("fecha", { ascending: false })
          .order("created_at", { ascending: false }),
      ),
  });

export const documentosQuery = (expedienteId: string) =>
  queryOptions({
    queryKey: ["documentos", expedienteId],
    queryFn: async () =>
      check(
        await supabase
          .from("documentos")
          .select("*")
          .eq("expediente_id", expedienteId)
          .order("created_at", { ascending: false }),
      ),
  });

export const plazosQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["plazos", estudioId],
    queryFn: async () =>
      check(
        await supabase
          .from("plazos")
          .select("*, expediente:expedientes(id, titulo, numero_expediente)")
          .eq("estudio_id", estudioId)
          .order("fecha_vencimiento"),
      ),
  });

export const eventosQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["eventos", estudioId],
    queryFn: async () =>
      check(
        await supabase
          .from("eventos")
          .select("*, expediente:expedientes(id, titulo, numero_expediente)")
          .eq("estudio_id", estudioId)
          .order("inicio"),
      ),
  });

export const honorariosQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["honorarios", estudioId],
    queryFn: async () =>
      check(
        await supabase
          .from("honorarios")
          .select(
            "*, pagos(*), cliente:clientes(id, nombres, apellidos, razon_social, tipo_persona, telefono, email), expediente:expedientes(id, titulo, numero_expediente)",
          )
          .eq("estudio_id", estudioId)
          .order("fecha", { ascending: false }),
      ),
  });

export const plantillasQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["plantillas", estudioId],
    queryFn: async () =>
      check(
        await supabase
          .from("plantillas")
          .select("*, items:plantilla_items(*)")
          .eq("estudio_id", estudioId)
          .order("nombre"),
      ),
  });

export const gastosQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["gastos", estudioId],
    queryFn: async () =>
      check(
        await supabase
          .from("gastos")
          .select("*, expediente:expedientes(id, titulo, numero_expediente)")
          .eq("estudio_id", estudioId)
          .order("fecha", { ascending: false }),
      ),
  });

export const miembrosQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["miembros", estudioId],
    queryFn: async () => {
      const miembros = check(
        await supabase.from("estudio_miembros").select("*").eq("estudio_id", estudioId).order("created_at"),
      );
      const ids = miembros.map((m) => m.user_id);
      const perfiles = ids.length
        ? check(await supabase.from("profiles").select("*").in("id", ids))
        : [];
      return miembros.map((m) => ({
        ...m,
        rol: m.rol as Rol,
        perfil: perfiles.find((p) => p.id === m.user_id) ?? null,
      }));
    },
  });

export const invitacionesQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["invitaciones", estudioId],
    queryFn: async () =>
      check(
        await supabase
          .from("invitaciones")
          .select("*")
          .eq("estudio_id", estudioId)
          .order("created_at", { ascending: false }),
      ),
  });

export const auditoriaQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["auditoria", estudioId],
    queryFn: async () =>
      check(
        await supabase
          .from("auditoria")
          .select("*")
          .eq("estudio_id", estudioId)
          .order("created_at", { ascending: false })
          .limit(200),
      ),
  });

export type MiembroConPerfil = Tables<"estudio_miembros"> & { rol: Rol; perfil: Profile | null };

export function nombreMiembro(
  miembros: { user_id: string; perfil: Profile | null }[],
  userId?: string | null,
) {
  if (!userId) return "Sin asignar";
  const m = miembros.find((x) => x.user_id === userId);
  return m?.perfil?.nombre_completo || m?.perfil?.email || "Miembro";
}

export type Fase = Tables<"fases">;
export type CampoPersonalizado = Tables<"campos_personalizados">;

export const fasesQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["fases", estudioId],
    queryFn: async () =>
      check(await supabase.from("fases").select("*").eq("estudio_id", estudioId).order("orden")),
  });

export const camposPersonalizadosQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["campos-personalizados", estudioId],
    queryFn: async () =>
      check(
        await supabase.from("campos_personalizados").select("*").eq("estudio_id", estudioId).order("orden"),
      ),
  });
