// Modo demostración: el portal valida el token y usa los archivos guardados en este navegador.
import { z } from "zod";
import { accesoPortal, guardarDB, leerDB, nuevoId } from "@/lib/demo-client";
import { leerArchivo } from "@/lib/demo-archivos";

const tokenSchema = z.string().min(20).max(256);
const uploadSchema = z.object({
  token: tokenSchema,
  expedienteId: z.string().min(1),
  nombre: z.string().trim().min(1).max(200),
  tamano: z.number().int().positive().max(25 * 1024 * 1024),
  mime: z.string().trim().min(1).max(150),
});

const INVALIDO = "Este enlace del portal no es válido o caducó";

function expedienteDelCliente(token: string, expedienteId: string) {
  const db = leerDB();
  const acc = accesoPortal(db, token);
  if (!acc) throw new Error(INVALIDO);
  const exp = (db["expedientes"] ?? []).find((e) => e["id"] === expedienteId && e["cliente_id"] === acc["cliente_id"]);
  if (!exp) throw new Error("Expediente no disponible");
  return { db, acc };
}

export async function portalDescargar({ data }: { data: { token: string; documentoId: string } }): Promise<{ url: string }> {
  const { token, documentoId } = z.object({ token: tokenSchema, documentoId: z.string().min(1) }).parse(data);
  const db = leerDB();
  const acc = accesoPortal(db, token);
  if (!acc) throw new Error(INVALIDO);
  const expIds = new Set((db["expedientes"] ?? []).filter((e) => e["cliente_id"] === acc["cliente_id"]).map((e) => e["id"]));
  const doc = (db["documentos"] ?? []).find((d) => d["id"] === documentoId
    && (d["visible_cliente"] || d["subido_por_cliente"]) && (expIds.has(d["expediente_id"]) || d["cliente_id"] === acc["cliente_id"]));
  if (!doc) throw new Error("Documento no disponible");
  const blob = await leerArchivo(String(doc["storage_path"]));
  if (!blob) throw new Error("El archivo no está guardado en este navegador");
  return { url: URL.createObjectURL(blob) };
}

export async function portalSubirInicio({ data }: { data: z.input<typeof uploadSchema> }): Promise<{ path: string; token: string }> {
  const v = uploadSchema.parse(data);
  const { acc } = expedienteDelCliente(v.token, v.expedienteId);
  const limpio = v.nombre.replace(/[^\w.\- ]+/g, "_");
  return { path: `${String(acc["estudio_id"])}/${v.expedienteId}/portal-${nuevoId()}-${limpio}`, token: "demo" };
}

export async function portalSubirConfirmar({ data }: { data: z.input<typeof uploadSchema> & { path: string } }): Promise<{ id: string; avisoPendiente?: boolean }> {
  const v = uploadSchema.extend({ path: z.string().min(1).max(600) }).parse(data);
  const { db, acc } = expedienteDelCliente(v.token, v.expedienteId);
  if (!v.path.startsWith(`${String(acc["estudio_id"])}/${v.expedienteId}/portal-`)) throw new Error("Ruta inválida");
  const now = new Date().toISOString();
  const id = nuevoId();
  (db["documentos"] ??= []).push({
    id, estudio_id: acc["estudio_id"], expediente_id: v.expedienteId, cliente_id: acc["cliente_id"], nombre: v.nombre,
    storage_path: v.path, mime_type: v.mime, tamano: v.tamano, categoria: "otro", version: 1, documento_origen: null,
    visible_cliente: true, subido_por_cliente: true, subido_por: null, created_at: now,
  });
  (db["notificaciones"] ??= []).push({
    id: nuevoId(), estudio_id: acc["estudio_id"], user_id: null, tipo: "documento",
    titulo: "El cliente subió un documento", detalle: v.nombre, enlace: `/expedientes/${v.expedienteId}`, created_at: now,
  });
  guardarDB(db);
  return { id };
}
