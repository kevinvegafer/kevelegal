/**
 * Convierte los datos del estudio en entradas del índice de búsqueda.
 * Puro y sin acceso a datos: cuando exista un servidor de búsqueda, solo cambia de dónde
 * llegan los registros; el motor (`busqueda.ts`) y la interfaz siguen igual.
 */
import type { Entrada } from "@/lib/busqueda";
import { ESTADOS_EXPEDIENTE, MATERIAS, TIPOS_EVENTO, labelOf } from "@/lib/peru";

type ClienteMini = {
  id: string;
  nombres?: string | null;
  apellidos?: string | null;
  razon_social?: string | null;
  tipo_persona?: string | null;
};

export type FuentesBusqueda = {
  hoy: string; // yyyy-mm-dd
  clientes: (ClienteMini & {
    tipo_documento?: string | null;
    numero_documento?: string | null;
    email?: string | null;
    telefono?: string | null;
    representante_legal?: string | null;
    estado?: string | null;
    distrito?: string | null;
    updated_at?: string | null;
  })[];
  expedientes: {
    id: string;
    titulo: string;
    numero_expediente?: string | null;
    organo_jurisdiccional?: string | null;
    distrito_judicial?: string | null;
    materia?: string | null;
    estado?: string | null;
    juez?: string | null;
    especialista?: string | null;
    tipo_proceso?: string | null;
    etapa?: string | null;
    descripcion?: string | null;
    updated_at?: string | null;
    cliente?: ClienteMini | null;
  }[];
  plazos: {
    id: string;
    titulo: string;
    estado?: string | null;
    fecha_vencimiento: string;
    notas?: string | null;
    expediente_id?: string | null;
    expediente?: { id: string; titulo: string; numero_expediente?: string | null } | null;
  }[];
  tareas: {
    id: string;
    titulo: string;
    notas?: string | null;
    fecha?: string | null;
    columna?: string | null;
    expediente_id?: string | null;
  }[];
  eventos: {
    id: string;
    titulo: string;
    inicio: string;
    tipo?: string | null;
    lugar?: string | null;
    notas?: string | null;
    expediente_id?: string | null;
    expediente?: { id: string; titulo: string; numero_expediente?: string | null } | null;
  }[];
  documentos: {
    id: string;
    nombre: string;
    categoria?: string | null;
    expediente_id?: string | null;
    created_at?: string | null;
  }[];
  partes: {
    id: string;
    nombre: string;
    rol?: string | null;
    numero_documento?: string | null;
    abogado?: string | null;
    expediente_id: string;
  }[];
  paginas: { to: string; label: string; claves?: string | undefined }[];
};

export function nombreDe(c?: ClienteMini | null) {
  if (!c) return "";
  if (c.tipo_persona === "juridica") return c.razon_social || "";
  return [c.nombres, c.apellidos].filter(Boolean).join(" ") || c.razon_social || "";
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function fechaCorta(iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number) as [number, number, number];
  return `${d} ${MESES[m - 1]} ${y}`;
}

/** 1 para lo de hoy o muy reciente, baja hacia 0 con los días. */
function cercania(iso: string | null | undefined, hoy: string) {
  if (!iso) return 0;
  const dias = Math.abs(Date.parse(iso.slice(0, 10)) - Date.parse(hoy)) / 864e5;
  return Math.max(0, 1 - dias / 120);
}

export function construirEntradas(f: FuentesBusqueda): Entrada[] {
  const out: Entrada[] = [];
  const expPorId = new Map(f.expedientes.map((e) => [e.id, e]));

  for (const e of f.expedientes) {
    const cliente = nombreDe(e.cliente);
    const activo = e.estado === "en_tramite" || !e.estado;
    out.push({
      clave: `expediente:${e.id}`,
      tipo: "expediente",
      titulo: e.titulo,
      subtitulo: [cliente, labelOf(MATERIAS, e.materia), e.organo_jurisdiccional].filter(Boolean).join(" · "),
      detalle: e.numero_expediente ?? undefined,
      estado: activo
        ? undefined
        : {
            texto: labelOf(ESTADOS_EXPEDIENTE, e.estado),
            tono: e.estado === "concluido" ? "success" : e.estado === "suspendido" ? "warning" : "muted",
          },
      campos: [
        { texto: e.titulo, peso: 3 },
        { texto: e.numero_expediente, peso: 3 },
        { texto: cliente, peso: 2 },
        { texto: e.organo_jurisdiccional, peso: 1 },
        { texto: e.distrito_judicial, peso: 0.6 },
        { texto: labelOf(MATERIAS, e.materia), peso: 1 },
        { texto: e.juez, peso: 1 },
        { texto: e.especialista, peso: 0.8 },
        { texto: e.tipo_proceso, peso: 0.8 },
        { texto: e.etapa, peso: 0.6 },
        { texto: e.descripcion, peso: 0.3 },
      ],
      destino: { ruta: "/expedientes/$id", id: e.id },
      relevancia: (activo ? 0.5 : 0) + cercania(e.updated_at, f.hoy) * 0.5,
    });
  }

  for (const c of f.clientes) {
    const nombre = nombreDe(c) || "Sin nombre";
    const doc = c.numero_documento ? `${c.tipo_documento ?? ""} ${c.numero_documento}`.trim() : undefined;
    out.push({
      clave: `cliente:${c.id}`,
      tipo: "cliente",
      titulo: nombre,
      subtitulo: [c.email, c.telefono, c.representante_legal].filter(Boolean).join(" · ") || undefined,
      detalle: doc,
      estado: c.estado && c.estado !== "activo" ? { texto: c.estado[0]!.toUpperCase() + c.estado.slice(1), tono: "muted" } : undefined,
      campos: [
        { texto: nombre, peso: 3 },
        { texto: c.numero_documento, peso: 3 },
        { texto: c.email, peso: 1.5 },
        { texto: c.telefono, peso: 1.5 },
        { texto: c.representante_legal, peso: 1 },
        { texto: c.distrito, peso: 0.5 },
      ],
      destino: { ruta: "/clientes/$id", id: c.id },
      relevancia: (c.estado === "activo" || !c.estado ? 0.5 : 0) + cercania(c.updated_at, f.hoy) * 0.5,
    });
  }

  for (const p of f.plazos) {
    const exp = p.expediente ?? (p.expediente_id ? expPorId.get(p.expediente_id) : undefined);
    const hecho = p.estado === "completado";
    const vencido = !hecho && p.fecha_vencimiento < f.hoy;
    out.push({
      clave: `plazo:${p.id}`,
      tipo: "plazo",
      titulo: p.titulo,
      subtitulo: exp ? [exp.titulo, exp.numero_expediente].filter(Boolean).join(" · ") : undefined,
      detalle: fechaCorta(p.fecha_vencimiento),
      estado: hecho
        ? { texto: "Completado", tono: "muted" }
        : vencido
          ? { texto: "Vencido", tono: "destructive" }
          : p.fecha_vencimiento === f.hoy
            ? { texto: "Hoy", tono: "warning" }
            : undefined,
      campos: [
        { texto: p.titulo, peso: 3 },
        { texto: exp?.titulo, peso: 1.2 },
        { texto: exp?.numero_expediente, peso: 1.5 },
        { texto: p.notas, peso: 0.4 },
      ],
      destino: exp ? { ruta: "/expedientes/$id", id: exp.id, tab: "plazos" } : { ruta: "/plazos" },
      relevancia: (hecho ? 0 : 0.5) + cercania(p.fecha_vencimiento, f.hoy) * 0.5,
    });
  }

  for (const t of f.tareas) {
    const exp = t.expediente_id ? expPorId.get(t.expediente_id) : undefined;
    const hecha = t.columna === "hecho";
    out.push({
      clave: `tarea:${t.id}`,
      tipo: "tarea",
      titulo: t.titulo,
      subtitulo: exp ? [exp.titulo, exp.numero_expediente].filter(Boolean).join(" · ") : t.notas?.slice(0, 90) || undefined,
      detalle: t.fecha ? fechaCorta(t.fecha) : "Algún día",
      estado: hecha ? { texto: "Hecha", tono: "muted" } : t.fecha && t.fecha < f.hoy ? { texto: "Vencida", tono: "destructive" } : undefined,
      campos: [
        { texto: t.titulo, peso: 3 },
        { texto: t.notas, peso: 0.6 },
        { texto: exp?.titulo, peso: 1 },
        { texto: exp?.numero_expediente, peso: 1.2 },
      ],
      destino: exp ? { ruta: "/expedientes/$id", id: exp.id, tab: "tareas" } : { ruta: "/plazos" },
      relevancia: (hecha ? 0 : 0.5) + cercania(t.fecha, f.hoy) * 0.5,
    });
  }

  for (const ev of f.eventos) {
    const exp = ev.expediente ?? (ev.expediente_id ? expPorId.get(ev.expediente_id) : undefined);
    const dia = ev.inicio.slice(0, 10);
    out.push({
      clave: `evento:${ev.id}`,
      tipo: "evento",
      titulo: ev.titulo,
      subtitulo: [labelOf(TIPOS_EVENTO, ev.tipo), exp?.titulo, ev.lugar].filter(Boolean).join(" · ") || undefined,
      detalle: fechaCorta(dia),
      estado: dia < f.hoy ? { texto: "Pasado", tono: "muted" } : dia === f.hoy ? { texto: "Hoy", tono: "warning" } : undefined,
      campos: [
        { texto: ev.titulo, peso: 3 },
        { texto: labelOf(TIPOS_EVENTO, ev.tipo), peso: 1 },
        { texto: ev.lugar, peso: 1 },
        { texto: exp?.titulo, peso: 1 },
        { texto: exp?.numero_expediente, peso: 1.2 },
        { texto: ev.notas, peso: 0.4 },
      ],
      destino: { ruta: "/calendario", dia },
      relevancia: (dia >= f.hoy ? 0.5 : 0) + cercania(dia, f.hoy) * 0.5,
    });
  }

  for (const d of f.documentos) {
    const exp = d.expediente_id ? expPorId.get(d.expediente_id) : undefined;
    if (!exp) continue;
    out.push({
      clave: `documento:${d.id}`,
      tipo: "documento",
      titulo: d.nombre,
      subtitulo: [exp.titulo, exp.numero_expediente].filter(Boolean).join(" · "),
      detalle: d.categoria ?? undefined,
      campos: [
        { texto: d.nombre, peso: 3 },
        { texto: d.categoria, peso: 0.8 },
        { texto: exp.titulo, peso: 1 },
        { texto: exp.numero_expediente, peso: 1.2 },
      ],
      destino: { ruta: "/expedientes/$id", id: exp.id, tab: "documentos" },
      relevancia: cercania(d.created_at, f.hoy) * 0.5,
    });
  }

  for (const p of f.partes) {
    const exp = expPorId.get(p.expediente_id);
    if (!exp) continue;
    out.push({
      clave: `parte:${p.id}`,
      tipo: "parte",
      titulo: p.nombre,
      subtitulo: [p.rol, exp.titulo].filter(Boolean).join(" · "),
      detalle: p.numero_documento ?? undefined,
      campos: [
        { texto: p.nombre, peso: 3 },
        { texto: p.numero_documento, peso: 3 },
        { texto: p.rol, peso: 0.8 },
        { texto: p.abogado, peso: 1 },
        { texto: exp.titulo, peso: 0.8 },
        { texto: exp.numero_expediente, peso: 1 },
      ],
      destino: { ruta: "/expedientes/$id", id: exp.id, tab: "partes" },
    });
  }

  for (const pg of f.paginas) {
    out.push({
      clave: `pagina:${pg.to}`,
      tipo: "pagina",
      titulo: pg.label,
      campos: [
        { texto: pg.label, peso: 2.5 },
        { texto: pg.claves, peso: 1 },
      ],
      destino: { ruta: "pagina", to: pg.to },
    });
  }

  return out;
}
