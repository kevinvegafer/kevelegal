import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

const tokenSchema = z.string().min(20).max(256);
const uploadSchema = z.object({
  token: tokenSchema,
  expedienteId: z.string().uuid(),
  nombre: z.string().trim().min(1).max(200),
  tamano: z.number().int().positive().max(25 * 1024 * 1024),
  mime: z.string().trim().min(1).max(150),
});

async function accesoValido(admin: Admin, token: string) {
  const { data, error } = await admin.from("portal_accesos")
    .select("id, estudio_id, cliente_id")
    .eq("token", token)
    .eq("activo", true)
    .or(`expira_at.is.null,expira_at.gt.${new Date().toISOString()}`)
    .maybeSingle();

  if (error || !data) throw new Error("Enlace no válido o vencido");
  return data;
}

async function expedienteValido(
  admin: Admin,
  acceso: { estudio_id: string; cliente_id: string },
  expedienteId: string,
) {
  const { data, error } = await admin.from("expedientes")
    .select("id")
    .eq("id", expedienteId)
    .eq("estudio_id", acceso.estudio_id)
    .eq("cliente_id", acceso.cliente_id)
    .maybeSingle();

  if (error || !data) throw new Error("Expediente no disponible");
}

function safeName(nombre: string) {
  return nombre.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 160) || "documento";
}

export const portalDescargar = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: tokenSchema,
    documentoId: z.string().uuid(),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } =
      await import("@/integrations/supabase/client.server");
    const acceso = await accesoValido(admin, data.token);

    const { data: documento, error } = await admin.from("documentos")
      .select("storage_path")
      .eq("id", data.documentoId)
      .eq("estudio_id", acceso.estudio_id)
      .eq("cliente_id", acceso.cliente_id)
      .or("visible_cliente.eq.true,subido_por_cliente.eq.true")
      .maybeSingle();

    if (error || !documento) {
      throw new Error("Documento no disponible");
    }
    if (!documento.storage_path.startsWith(`${acceso.estudio_id}/`)) {
      throw new Error("Documento no disponible");
    }

    const result = await admin.storage.from("documentos")
      .createSignedUrl(documento.storage_path, 60, { download: true });

    if (result.error) throw new Error("No se pudo preparar la descarga");
    return { url: result.data.signedUrl };
  });

export const portalSubirInicio = createServerFn({ method: "POST" })
  .inputValidator(uploadSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } =
      await import("@/integrations/supabase/client.server");
    const acceso = await accesoValido(admin, data.token);
    await expedienteValido(admin, acceso, data.expedienteId);

    const path =
      `${acceso.estudio_id}/${data.expedienteId}/portal/` +
      `${crypto.randomUUID()}-${safeName(data.nombre)}`;

    const result = await admin.storage.from("documentos")
      .createSignedUploadUrl(path, { upsert: false });

    if (result.error) throw new Error("No se pudo iniciar la carga");
    return { path, token: result.data.token };
  });

export const portalSubirConfirmar = createServerFn({ method: "POST" })
  .inputValidator(uploadSchema.extend({
    path: z.string().min(1).max(600),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } =
      await import("@/integrations/supabase/client.server");
    const acceso = await accesoValido(admin, data.token);
    await expedienteValido(admin, acceso, data.expedienteId);

    const prefix =
      `${acceso.estudio_id}/${data.expedienteId}/portal/`;
    const filename = data.path.slice(prefix.length);

    if (
      !data.path.startsWith(prefix) ||
      !/^[0-9a-f-]{36}-[a-zA-Z0-9._-]+$/.test(filename) ||
      filename.includes("..")
    ) {
      throw new Error("Ruta de documento no válida");
    }

    // Verificar el objeto real, no confiar únicamente en los metadatos del cliente.
    const object = await admin.storage.from("documentos").info(data.path);
    if (object.error || !object.data) {
      throw new Error("La carga no se completó");
    }
    if (object.data.size !== data.tamano ||
        object.data.size > 25 * 1024 * 1024) {
      throw new Error("El tamaño del archivo no coincide o supera 25 MB");
    }

    // Evita duplicar el documento al reintentar la confirmación.
    const existing = await admin.from("documentos")
      .select("id")
      .eq("estudio_id", acceso.estudio_id)
      .eq("cliente_id", acceso.cliente_id)
      .eq("storage_path", data.path)
      .maybeSingle();
    if (existing.error) throw new Error("No se pudo verificar el documento");
    if (existing.data) return { id: existing.data.id };

    const result = await admin.from("documentos").insert({
      estudio_id: acceso.estudio_id,
      expediente_id: data.expedienteId,
      cliente_id: acceso.cliente_id,
      nombre: data.nombre,
      categoria: "cliente",
      storage_path: data.path,
      mime_type: object.data.contentType || data.mime,
      tamano: object.data.size,
      subido_por_cliente: true,
      subido_por: null,
    }).select("id").single();

    if (result.error) throw new Error("No se pudo registrar el documento");

    const [miembros, cliente] = await Promise.all([
      admin.from("estudio_miembros")
        .select("user_id, rol")
        .eq("estudio_id", acceso.estudio_id),
      admin.from("clientes")
        .select("responsable_id")
        .eq("id", acceso.cliente_id)
        .eq("estudio_id", acceso.estudio_id)
        .single(),
    ]);

    if (miembros.error || cliente.error) {
      // El documento ya está guardado: no inducir una nueva carga.
      return { id: result.data.id, avisoPendiente: true };
    }

    const destinatarios = miembros.data
      .filter((m) => m.rol === "admin" ||
        m.user_id === cliente.data.responsable_id)
      .map((m) => m.user_id);

    const ids = [...new Set(destinatarios)];
    if (ids.length) {
      const aviso = await admin.from("notificaciones").insert(
        ids.map((user_id) => ({
          estudio_id: acceso.estudio_id,
          user_id,
          tipo: "documento",
          titulo: "El cliente subió un documento",
          detalle: data.nombre,
          enlace: `/expedientes/${data.expedienteId}`,
        })),
      );
      if (aviso.error) {
        return { id: result.data.id, avisoPendiente: true };
      }
    }

    return { id: result.data.id };
  });
