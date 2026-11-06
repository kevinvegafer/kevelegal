import { supabase } from "@/lib/demo-db/client";
import type { Tables } from "@/lib/demo-db/types";
export const tablasRespaldo = [
  "clientes",
  "expedientes",
  "partes_procesales",
  "actuaciones",
  "plazos",
  "eventos",
  "honorarios",
  "pagos",
  "cuotas",
  "gastos",
  "documentos",
  "registros_tiempo",
  "plantillas",
  "plantilla_items",
  "fases",
  "campos_personalizados",
  "mensajes_cliente",
  "citas",
  "estudio_miembros",
  "auditoria",
] as const;
export type TablaRespaldo = (typeof tablasRespaldo)[number];
export async function leerTabla<T extends TablaRespaldo>(
  tabla: T,
  estudioId: string,
): Promise<Tables<T>[]> {
  const rows: Tables<T>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from(tabla as TablaRespaldo)
      .select("*")
      .eq("estudio_id", estudioId)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    // Supabase cannot preserve the generic table-to-row mapping across its conditional query types.
    const pagina = data as unknown as Tables<T>[];
    rows.push(...pagina);
    if (pagina.length < 1000) return rows;
  }
}
export function csv(rows: readonly object[]) {
  const columnas = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (value: unknown) => {
    let text =
      value === null || value === undefined
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      columnas.map(escape).join(","),
      ...rows.map((r) => columnas.map((c) => escape((r as Record<string, unknown>)[c])).join(",")),
    ].join("\r\n")
  );
}
export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
