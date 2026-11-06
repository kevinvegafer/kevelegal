// Tareas personales del abogado (estilo Trello + Focus).
// En modo demo se guardan en este navegador mediante el cliente local.
import { queryOptions } from "@tanstack/react-query";
import { demoClient } from "@/lib/demo-client";

export type Visibilidad = "privada" | "estudio";
export type Columna = "por_hacer" | "en_curso" | "revision" | "hecho";
export type Prioridad = "alta" | "media" | "baja";

export type Adjunto = { id: string; nombre: string; tipo: string; tamano: number; dataUrl: string; subido_at: string };

export type Tarea = {
  id: string;
  estudio_id: string;
  created_by: string;
  titulo: string;
  notas: string | null;
  fecha: string | null; // yyyy-mm-dd; null = algún día
  expediente_id: string | null;
  columna: Columna;
  prioridad: Prioridad;
  visibilidad: Visibilidad;
  orden: number;
  adjuntos: Adjunto[];
  completada_at: string | null;
  created_at: string;
  updated_at: string;
};

export const COLUMNAS: { value: Columna; label: string }[] = [
  { value: "por_hacer", label: "Por hacer" },
  { value: "en_curso", label: "En curso" },
  { value: "revision", label: "En revisión" },
  { value: "hecho", label: "Hecho" },
];

export type Grupo = "vencidas" | "hoy" | "manana" | "semana" | "planificadas" | "algun_dia";

export const GRUPOS: { value: Grupo; label: string }[] = [
  { value: "vencidas", label: "Vencidas" },
  { value: "hoy", label: "Hoy" },
  { value: "manana", label: "Mañana" },
  { value: "semana", label: "Esta semana" },
  { value: "planificadas", label: "Planificadas" },
  { value: "algun_dia", label: "Algún día" },
];

function sumarDias(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Domingo de la semana (lunes a domingo) que contiene `hoy`. */
export function finDeSemana(hoy: string) {
  const [y, m, d] = hoy.split("-").map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  return sumarDias(hoy, dow === 0 ? 0 : 7 - dow);
}

/** Clasifica una fecha en el grupo de enfoque correspondiente. */
export function grupoDe(fecha: string | null, hoy: string): Grupo {
  if (!fecha) return "algun_dia";
  if (fecha < hoy) return "vencidas";
  if (fecha === hoy) return "hoy";
  if (fecha === sumarDias(hoy, 1)) return "manana";
  if (fecha <= finDeSemana(hoy)) return "semana";
  return "planificadas";
}

/** El abogado ve sus tareas privadas y todas las compartidas con el estudio. */
export function visiblePara(t: Pick<Tarea, "visibilidad" | "created_by">, userId: string) {
  return t.visibilidad === "estudio" || t.created_by === userId;
}

export const MAX_ADJUNTO = 2 * 1024 * 1024;

type Res<T> = { data: T; error: { message: string } | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = demoClient as any;

function ok<T>(r: Res<T>): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export const tareasQuery = (estudioId: string, userId: string) =>
  queryOptions({
    queryKey: ["mis-tareas", estudioId, userId],
    queryFn: async () => {
      const rows = (ok(await db.from("tareas").select("*").eq("estudio_id", estudioId)) ?? []) as Tarea[];
      return rows
        .filter((t) => visiblePara(t, userId))
        .map((t) => ({ ...t, adjuntos: t.adjuntos ?? [] }))
        .sort((a, b) => a.orden - b.orden || (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999"));
    },
  });

export async function crearTarea(v: Partial<Tarea> & { estudio_id: string; created_by: string; titulo: string }) {
  return ok(
    await db
      .from("tareas")
      .insert({
        notas: null, fecha: null, expediente_id: null, columna: "por_hacer", prioridad: "media",
        visibilidad: "privada", orden: Date.now(), adjuntos: [], completada_at: null, ...v,
      })
      .select()
      .single(),
  ) as Tarea;
}

export async function actualizarTarea(id: string, patch: Partial<Tarea>) {
  const p = { ...patch };
  if (p.columna === "hecho" && p.completada_at === undefined) p.completada_at = new Date().toISOString();
  if (p.columna && p.columna !== "hecho") p.completada_at = null;
  ok(await db.from("tareas").update(p).eq("id", id));
}

export async function eliminarTarea(id: string) {
  ok(await db.from("tareas").delete().eq("id", id));
}

export function leerArchivo(file: File): Promise<Adjunto> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_ADJUNTO) return reject(new Error(`«${file.name}» supera 2 MB (límite del modo demo)`));
    const r = new FileReader();
    r.onload = () =>
      resolve({
        id: crypto.randomUUID(), nombre: file.name, tipo: file.type || "application/octet-stream",
        tamano: file.size, dataUrl: String(r.result), subido_at: new Date().toISOString(),
      });
    r.onerror = () => reject(new Error(`No se pudo leer «${file.name}»`));
    r.readAsDataURL(file);
  });
}
