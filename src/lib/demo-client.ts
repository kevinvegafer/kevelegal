/**
 * Modo prueba local: imita el cliente de datos usando solo el navegador
 * (localStorage). No se conecta a ningún servidor.
 */
import { derivarAvisos, estadoEnlace, horarioLibre } from "@/lib/demo-reglas";
import { borrarArchivos, borrarTodo, guardarArchivo, leerArchivo } from "@/lib/demo-archivos";
import { segundosAMonto } from "@/lib/cobranza";

const FLAG = "kevelegal-demo";
const DB_KEY = "kevelegal-demo-db-v2";
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_ESTUDIO_ID = "00000000-0000-4000-8000-0000000000e1";

type Row = Record<string, unknown>;
type DB = Record<string, Row[]>;

// Sin base de datos: el modo prueba está siempre activo en el navegador.
export function demoActivo() {
  return typeof window !== "undefined";
}

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const FASES_LEGALES = [
  "Prospectos / clientes nuevos",
  "Estudio / redacción",
  "Presentado / en espera",
  "Probatoria / audiencias",
  "Alegatos / sentencia",
  "Ejecución / archivo",
];

function hoy(dias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function semilla(): DB {
  const now = new Date().toISOString();
  const base = { created_at: now, updated_at: now, estudio_id: DEMO_ESTUDIO_ID };
  const c1 = uid(), c2 = uid(), e1 = uid(), e2 = uid(), e3 = uid(), e4 = uid(), e5 = uid(), e6 = uid();
  const f = FASES_LEGALES.map(() => uid());
  const exp = (id: string, cliente_id: string, titulo: string, materia: string, numero: string | null, organo: string | null, fase_id: string | undefined, diasFase: number, inicio: number) => ({
    ...base, id, cliente_id, titulo, materia, via: "judicial", estado: "en_tramite", numero_expediente: numero,
    organo_jurisdiccional: organo, distrito_judicial: "Lima", responsable_id: DEMO_USER_ID, campos_extra: {},
    fase_id, fase_desde: new Date(Date.now() - diasFase * 864e5).toISOString(), fecha_inicio: hoy(inicio),
  });
  const plazo = (expediente_id: string, titulo: string, prioridad: string, dias: number) => ({
    ...base, id: uid(), expediente_id, titulo, tipo: "plazo_procesal", estado: "pendiente", prioridad,
    fecha_vencimiento: hoy(dias), asignado_a: DEMO_USER_ID, desfase_dias: 0, parent_id: null, depende_de: null, completado_at: null,
  });
  return {
    estudios: [{
      id: DEMO_ESTUDIO_ID, nombre: "Estudio de prueba", departamento: "Lima", provincia: "Lima", distrito: "Miraflores",
      ruc: null, direccion: null, email: null, telefono: null, agenda_activa: false, agenda_anticipacion_horas: 24,
      agenda_duracion_min: 30, agenda_slug: null, recordatorios_evento: [], tarifa_hora: 250,
      created_by: DEMO_USER_ID, created_at: now, updated_at: now,
    }],
    estudio_miembros: [{ id: uid(), estudio_id: DEMO_ESTUDIO_ID, user_id: DEMO_USER_ID, rol: "admin", created_at: now }],
    profiles: [{ id: DEMO_USER_ID, nombre_completo: "Usuario de prueba", email: "prueba@kevelegal.pe", colegiatura: null, telefono: null, created_at: now, updated_at: now }],
    clientes: [
      { ...base, id: c1, tipo_persona: "natural", nombres: "María", apellidos: "Quispe Huamán", razon_social: null, tipo_documento: "DNI", numero_documento: "45678912", estado: "activo", email: "maria@correo.pe", telefono: "987654321", responsable_id: DEMO_USER_ID },
      { ...base, id: c2, tipo_persona: "juridica", nombres: null, apellidos: null, razon_social: "Inversiones Andinas S.A.C.", tipo_documento: "RUC", numero_documento: "20512345678", estado: "activo", email: null, telefono: null, responsable_id: DEMO_USER_ID },
    ],
    fases: FASES_LEGALES.map((nombre, i) => ({ id: f[i], estudio_id: DEMO_ESTUDIO_ID, nombre, orden: i, plantilla_id: null, created_at: now })),
    expedientes: [
      exp(e1, c1, "Alimentos — Quispe", "familia", "01234-2026-0-1801-JP-FC-01", "1.er Juzgado de Paz Letrado de Lima", f[3], 12, -30),
      exp(e2, c2, "Cobro de soles — Inversiones Andinas", "civil", "04512-2026-0-1801-JR-CI-03", "3.er Juzgado Civil de Lima", f[2], 20, -10),
      exp(e3, c2, "Desnaturalización de contrato — Andinas", "laboral", "08877-2026-0-1801-JR-LA-07", "7.º Juzgado de Trabajo de Lima", f[1], 4, -5),
      exp(e4, c1, "Defensa por apropiación ilícita", "penal", "00321-2026-1-1801-JR-PE-02", "2.º Juzgado de Investigación Preparatoria", f[4], 45, -90),
      exp(e5, c2, "Constitución de sociedad y pacto de socios", "comercial", null, null, f[0], 2, -2),
      exp(e6, c1, "Ejecución de acta de conciliación", "civil", "02210-2025-0-1801-JR-CI-01", "1.er Juzgado Civil de Lima", f[5], 70, -200),
    ],
    plazos: [
      plazo(e1, "Absolver traslado de la demanda", "alta", 1),
      plazo(e2, "Presentar escrito de subsanación", "media", 6),
      plazo(e3, "Redactar demanda laboral", "alta", 3),
      plazo(e4, "Presentar alegatos finales", "alta", 0),
      plazo(e6, "Solicitar embargo en forma de retención", "media", -1),
    ],
    eventos: [
      { ...base, id: uid(), expediente_id: e1, titulo: "Audiencia única", tipo: "audiencia", modalidad: "presencial", inicio: new Date(Date.now() + 5 * 864e5).toISOString(), fin: null, lugar: "Juzgado de Paz Letrado", responsable_id: DEMO_USER_ID, recordatorios: [] },
    ],
  };
}

function leer(): DB {
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch { /* ignore */ }
  const db = semilla();
  guardar(db);
  return db;
}
function guardar(db: DB) {
  try { window.localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* ignore */ }
}

export function activarDemo() {
  window.localStorage.setItem(FLAG, "1");
  leer();
  return DEMO_ESTUDIO_ID;
}
export function salirDemo() {
  // Cerrar sesión reinicia los datos de ejemplo; el modo prueba sigue disponible.
  window.localStorage.removeItem(FLAG);
  window.localStorage.removeItem(DB_KEY);
  void borrarTodo();
}

const demoUser = { id: DEMO_USER_ID, email: "prueba@kevelegal.pe", is_anonymous: true, user_metadata: { nombre_completo: "Usuario de prueba" }, app_metadata: {}, aud: "authenticated", created_at: "" };
const demoSession = { access_token: "demo", refresh_token: "demo", user: demoUser, expires_at: 9999999999, token_type: "bearer" };

// ---------- consultas ----------
function singular(t: string) {
  return [t.replace(/es$/, ""), t.replace(/s$/, ""), t];
}

type Embed = { alias: string; table: string; cols: string };
function parseSelect(sel: string): { cols: string[]; embeds: Embed[] } {
  const embeds: Embed[] = [];
  const cols: string[] = [];
  let depth = 0, cur = "";
  const parts: string[] = [];
  for (const ch of sel) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  for (const p0 of parts) {
    const p = p0.trim();
    const m = p.match(/^(?:(\w+):)?(\w+)(?:!\w+)?\((.*)\)$/s);
    if (m) embeds.push({ alias: m[1] ?? m[2]!, table: m[2]!, cols: m[3]! });
    else cols.push(p.includes(":") ? p.split(":")[1]! : p);
  }
  return { cols, embeds };
}

function proyectar(db: DB, table: string, row: Row, sel: string): Row {
  const { cols, embeds } = parseSelect(sel);
  const out: Row = cols.includes("*") || cols.length === 0 ? { ...row } : {};
  for (const c of cols) if (c !== "*") out[c] = row[c];
  for (const e of embeds) {
    const target = db[e.table] ?? [];
    const fk = [e.alias + "_id", ...singular(e.table).map((s) => s + "_id")].find((k) => k in row);
    if (fk) {
      const r = target.find((t) => t["id"] === row[fk]);
      out[e.alias] = r ? proyectar(db, e.table, r, e.cols) : null;
    } else {
      const back = singular(table).map((s) => s + "_id");
      out[e.alias] = target
        .filter((t) => back.some((b) => t[b] === row["id"]))
        .map((t) => proyectar(db, e.table, t, e.cols));
    }
  }
  return out;
}

function cmp(a: unknown, b: unknown) {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function parseVal(v: string): unknown {
  if (v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

function tokenSeguro() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
// Valores por defecto que pondría la base de datos.
const DEFAULTS: Record<string, () => Row> = {
  enlaces_documento: () => ({ token: tokenSeguro(), revocado: false, vistas: 0 }),
  portal_accesos: () => ({ token: tokenSeguro(), activo: true, expira_at: null, ultimo_acceso: null }),
  avisos_descartados: () => ({ user_id: DEMO_USER_ID }),
  documentos: () => ({ version: 1, visible_cliente: false, subido_por_cliente: false, categoria: "otro", subido_por: DEMO_USER_ID }),
  mensajes_cliente: () => ({ masivo: false, leido_at: null, autor_id: DEMO_USER_ID }),
  invitaciones: () => ({ aceptada_at: null, invitado_por: DEMO_USER_ID }),
  citas: () => ({ estado: "pendiente" }),
  notificaciones: () => ({ user_id: DEMO_USER_ID }),
};

type Pred = (r: Row) => boolean;
function opPred(col: string, op: string, val: unknown): Pred {
  switch (op) {
    case "eq": return (r) => r[col] == val; // eslint-disable-line eqeqeq
    case "neq": return (r) => r[col] != val; // eslint-disable-line eqeqeq
    case "gt": return (r) => r[col] != null && (r[col] as string) > (val as string);
    case "gte": return (r) => r[col] != null && (r[col] as string) >= (val as string);
    case "lt": return (r) => r[col] != null && (r[col] as string) < (val as string);
    case "lte": return (r) => r[col] != null && (r[col] as string) <= (val as string);
    case "is": return (r) => (val === null ? r[col] == null : r[col] === val);
    case "in": {
      const arr = Array.isArray(val) ? val : String(val).replace(/^\(|\)$/g, "").split(",");
      return (r) => arr.some((v) => v == r[col]); // eslint-disable-line eqeqeq
    }
    case "ilike":
    case "like": {
      const re = new RegExp("^" + String(val).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", "i");
      return (r) => re.test(String(r[col] ?? ""));
    }
    case "contains": return (r) => Array.isArray(r[col]) && (val as unknown[]).every((v) => (r[col] as unknown[]).includes(v));
    default: return () => true;
  }
}

class Query implements PromiseLike<{ data: unknown; error: null; count?: number }> {
  private preds: Pred[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private lim?: number;
  private from_ = 0;
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row[] = [];
  private patch: Row = {};
  private sel = "*";
  private returning = false;
  private one: "single" | "maybe" | null = null;
  private head = false;
  private wantCount = false;

  constructor(private table: string) {}

  select(sel = "*", opts?: { count?: string; head?: boolean }) {
    this.sel = sel;
    if (this.mode !== "select") this.returning = true;
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(v: Row | Row[]) { this.mode = "insert"; this.payload = Array.isArray(v) ? v : [v]; return this; }
  upsert(v: Row | Row[]) { this.mode = "upsert"; this.payload = Array.isArray(v) ? v : [v]; return this; }
  update(v: Row) { this.mode = "update"; this.patch = v; return this; }
  delete() { this.mode = "delete"; return this; }
  eq(c: string, v: unknown) { this.preds.push(opPred(c, "eq", v)); return this; }
  neq(c: string, v: unknown) { this.preds.push(opPred(c, "neq", v)); return this; }
  gt(c: string, v: unknown) { this.preds.push(opPred(c, "gt", v)); return this; }
  gte(c: string, v: unknown) { this.preds.push(opPred(c, "gte", v)); return this; }
  lt(c: string, v: unknown) { this.preds.push(opPred(c, "lt", v)); return this; }
  lte(c: string, v: unknown) { this.preds.push(opPred(c, "lte", v)); return this; }
  is(c: string, v: unknown) { this.preds.push(opPred(c, "is", v)); return this; }
  in(c: string, v: unknown[]) { this.preds.push(opPred(c, "in", v)); return this; }
  ilike(c: string, v: string) { this.preds.push(opPred(c, "ilike", v)); return this; }
  like(c: string, v: string) { this.preds.push(opPred(c, "like", v)); return this; }
  contains(c: string, v: unknown) { this.preds.push(opPred(c, "contains", v)); return this; }
  match(o: Row) { for (const [k, v] of Object.entries(o)) this.eq(k, v); return this; }
  not(c: string, op: string, v: unknown) { const p = opPred(c, op, parseVal(String(v))); this.preds.push((r) => !p(r)); return this; }
  filter(c: string, op: string, v: unknown) { this.preds.push(opPred(c, op, typeof v === "string" ? parseVal(v) : v)); return this; }
  or(expr: string) {
    const ps = expr.split(",").map((s) => {
      const [c, op, ...rest] = s.split(".");
      return opPred(c!, op!, parseVal(rest.join(".")));
    });
    this.preds.push((r) => ps.some((p) => p(r)));
    return this;
  }
  textSearch() { return this; }
  order(col: string, opts?: { ascending?: boolean; foreignTable?: string; referencedTable?: string }) {
    if (!opts?.foreignTable && !opts?.referencedTable) this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.from_ = a; this.lim = b - a + 1; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }
  abortSignal() { return this; }

  private run() {
    const db = leer();
    const rows = (db[this.table] ??= []);
    const now = new Date().toISOString();
    let result: Row[] = [];
    if (this.mode === "insert" || this.mode === "upsert") {
      for (const p of this.payload) {
        const existing = this.mode === "upsert"
          ? p["id"] ? rows.find((r) => r["id"] === p["id"])
            : this.table === "avisos_descartados" ? rows.find((r) => r["clave"] === p["clave"]) : undefined
          : undefined;
        if (existing) { Object.assign(existing, p, { updated_at: now }); result.push(existing); continue; }
        const r: Row = { id: uid(), created_at: now, updated_at: now, created_by: DEMO_USER_ID, ...(DEFAULTS[this.table]?.() ?? {}), ...p };
        rows.push(r);
        result.push(r);
      }
      guardar(db);
    } else {
      const matched = rows.filter((r) => this.preds.every((p) => p(r)));
      if (this.mode === "update") {
        for (const r of matched) Object.assign(r, this.patch, { updated_at: now });
        guardar(db);
      } else if (this.mode === "delete") {
        db[this.table] = rows.filter((r) => !matched.includes(r));
        guardar(db);
      }
      result = matched;
    }
    if (this.mode !== "select" && !this.returning) return { data: null, error: null };
    for (const o of [...this.orders].reverse()) {
      result = [...result].sort((a, b) => (o.asc ? 1 : -1) * cmp(a[o.col], b[o.col]));
    }
    const count = result.length;
    if (this.from_ || this.lim != null) result = result.slice(this.from_, this.lim != null ? this.from_ + this.lim : undefined);
    const data = result.map((r) => proyectar(db, this.table, r, this.sel));
    if (this.head) return { data: null, error: null, count };
    if (this.one) {
      if (this.one === "single" && data.length === 0) return { data: null, error: { message: "No se encontró el registro" } };
      return { data: data[0] ?? null, error: null, count };
    }
    return { data, error: null, ...(this.wantCount ? { count } : {}) };
  }

  then<A, B>(ok?: ((v: any) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(ok, fail);
  }
}

function rpc(name: string, args: Row = {}) {
  const db = leer();
  const now = new Date().toISOString();
  if (name === "crear_estudio") {
    const id = uid();
    (db["estudios"] ??= []).push({ ...semilla()["estudios"]![0], id, nombre: args["_nombre"] ?? "Estudio", departamento: args["_departamento"] ?? null, created_at: now, updated_at: now });
    (db["estudio_miembros"] ??= []).push({ id: uid(), estudio_id: id, user_id: DEMO_USER_ID, rol: "admin", created_at: now });
    guardar(db);
    return { data: id, error: null };
  }
  if (name === "aplicar_plantilla") {
    const items = (args["_items"] as Row[] | undefined) ?? [];
    for (const it of items) {
      const tabla = it["tipo_item"] === "evento" || it["inicio"] ? "eventos" : "plazos";
      (db[tabla] ??= []).push({ id: uid(), created_at: now, updated_at: now, estudio_id: args["_estudio_id"], expediente_id: args["_expediente_id"], estado: "pendiente", ...it });
    }
    guardar(db);
    return { data: null, error: null };
  }
  if (name === "mis_avisos" || name === "mis_avisos_estudio") {
    return { data: derivarAvisos(db, String(args["_estudio"] ?? DEMO_ESTUDIO_ID), DEMO_USER_ID, new Date()), error: null };
  }
  if (name === "portal_datos") {
    const acc = accesoPortal(db, args["_token"]);
    if (!acc) return fallo("Este enlace del portal no es válido o caducó");
    acc["ultimo_acceso"] = now;
    guardar(db);
    return { data: portalDatos(db, acc), error: null };
  }
  if (name === "portal_enviar_mensaje") {
    const acc = accesoPortal(db, args["_token"]);
    if (!acc) return fallo("Este enlace del portal no es válido o caducó");
    const cuerpo = String(args["_cuerpo"] ?? "").trim();
    if (!cuerpo || cuerpo.length > 4000) return fallo("Escriba un mensaje (máximo 4000 caracteres)");
    const id = uid();
    (db["mensajes_cliente"] ??= []).push({ id, estudio_id: acc["estudio_id"], cliente_id: acc["cliente_id"], expediente_id: args["_expediente"] ?? null,
      autor: "cliente", autor_id: null, cuerpo, masivo: false, leido_at: null, created_at: now });
    guardar(db);
    return { data: id, error: null };
  }
  if (name === "agenda_publica") {
    const est = (db["estudios"] ?? []).find((e) => e["agenda_slug"] === args["_slug"] && e["agenda_activa"]);
    if (!est) return { data: null, error: null };
    return { data: agendaPublica(db, est), error: null };
  }
  if (name === "reservar_cita") {
    const est = (db["estudios"] ?? []).find((e) => e["agenda_slug"] === args["_slug"] && e["agenda_activa"]);
    if (!est) return fallo("Agenda no disponible");
    const nombre = String(args["_nombre"] ?? "").trim();
    if (!nombre) return fallo("Escriba su nombre");
    const inicio = new Date(String(args["_inicio"])).toISOString();
    const fin = new Date(Date.parse(inicio) + Number(est["agenda_duracion_min"] ?? 30) * 60_000).toISOString();
    const ag = agendaPublica(db, est);
    if (!ag.abogados.some((a) => a.id === args["_user"])) return fallo("Profesional no disponible");
    if (Date.parse(inicio) < Date.now() + ag.anticipacion_horas * 3_600_000) return fallo("Ese horario ya no está disponible");
    if (!horarioLibre(ag.ocupado.filter((o) => o.user_id === args["_user"]), inicio, fin)) return fallo("Ese horario ya no está disponible");
    const id = uid();
    (db["citas"] ??= []).push({ id, estudio_id: est["id"], user_id: args["_user"], inicio, fin, nombre,
      email: args["_email"] || null, telefono: args["_telefono"] || null, motivo: args["_motivo"] || null,
      estado: "pendiente", evento_id: null, created_at: now });
    guardar(db);
    return { data: id, error: null };
  }
  if (name === "facturar_tiempo") {
    const ids = new Set((args["_registros"] as string[] | undefined) ?? []);
    const regs = (db["registros_tiempo"] ?? []).filter((r) => ids.has(String(r["id"])) && !r["honorario_id"] && !r["en_curso"]);
    if (!regs.length || regs.length !== ids.size) return fallo("Algunas horas ya fueron facturadas o siguen en curso");
    const est = (db["estudios"] ?? []).find((e) => e["id"] === args["_estudio"]);
    const tarifaBase = Number(est?.["tarifa_hora"] ?? 0);
    const total = regs.reduce((a, r) => a + segundosAMonto(Number(r["segundos"] ?? 0), Number(r["tarifa_hora"] ?? tarifaBase)), 0);
    const hid = uid();
    (db["honorarios"] ??= []).push({ id: hid, estudio_id: args["_estudio"], cliente_id: args["_cliente"], expediente_id: args["_expediente"] || null,
      concepto: String(args["_concepto"] ?? "Horas trabajadas"), modalidad: "por_hora", moneda: "PEN", monto_total: Math.round(total * 100) / 100,
      fecha: now.slice(0, 10), notas: null, created_by: DEMO_USER_ID, created_at: now, updated_at: now });
    for (const r of regs) r["honorario_id"] = hid;
    guardar(db);
    return { data: hid, error: null };
  }
  if (name === "aceptar_invitacion") {
    const inv = (db["invitaciones"] ?? []).find((i) => i["id"] === args["_invitacion"]);
    if (!inv) return fallo("La invitación no existe");
    inv["aceptada_at"] ??= now;
    const ya = (db["estudio_miembros"] ?? []).some((m) => m["estudio_id"] === inv["estudio_id"] && m["user_id"] === DEMO_USER_ID);
    if (!ya) (db["estudio_miembros"] ??= []).push({ id: uid(), estudio_id: inv["estudio_id"], user_id: DEMO_USER_ID, rol: inv["rol"], created_at: now });
    guardar(db);
    return { data: inv["estudio_id"], error: null };
  }
  if (name === "abrir_enlace") {
    const en = (db["enlaces_documento"] ?? []).find((e) => e["token"] === args["_token"]);
    const estado = estadoEnlace(en, new Date());
    if (estado !== "ok" || !en) return { data: { estado }, error: null };
    const doc = (db["documentos"] ?? []).find((d) => d["id"] === en["documento_id"]);
    if (!doc) return { data: { estado: "no_existe" }, error: null };
    en["vistas"] = Number(en["vistas"] ?? 0) + 1;
    guardar(db);
    return { data: { estado, nombre: doc["nombre"], mime: doc["mime_type"], path: doc["storage_path"], expira_at: en["expira_at"] }, error: null };
  }
  return fallo("Esta función no está disponible en el modo prueba");
}

function fallo(message: string) {
  return { data: null, error: new Error(message) };
}

export function accesoPortal(db: DB, token: unknown): Row | undefined {
  const acc = (db["portal_accesos"] ?? []).find((a) => a["token"] === token && a["activo"] !== false);
  if (!acc) return undefined;
  if (acc["expira_at"] && Date.parse(String(acc["expira_at"])) <= Date.now()) return undefined;
  return acc;
}

function portalDatos(db: DB, acc: Row) {
  const est = (db["estudios"] ?? []).find((e) => e["id"] === acc["estudio_id"]) ?? {};
  const cli = (db["clientes"] ?? []).find((c) => c["id"] === acc["cliente_id"]) ?? {};
  const fases = (db["fases"] ?? []).filter((f) => f["estudio_id"] === acc["estudio_id"]).sort((a, b) => Number(a["orden"]) - Number(b["orden"]));
  const exps = (db["expedientes"] ?? []).filter((e) => e["cliente_id"] === acc["cliente_id"] && e["estudio_id"] === acc["estudio_id"]);
  const expIds = new Set(exps.map((e) => e["id"]));
  const ahoraISO = new Date().toISOString();
  const txt = (v: unknown) => (v == null ? null : String(v));
  const pagos = db["pagos"] ?? [];
  return {
    estudio: { nombre: String(est["nombre"] ?? "Estudio"), telefono: txt(est["telefono"]), email: txt(est["email"]) },
    cliente: { nombre: String(cli["razon_social"] ?? [cli["nombres"], cli["apellidos"]].filter(Boolean).join(" ") ?? "Cliente") },
    expedientes: exps.map((e) => ({
      id: String(e["id"]), titulo: String(e["titulo"]), numero: txt(e["numero_expediente"]), estado: String(e["estado"] ?? ""),
      materia: String(e["materia"] ?? ""), fase: txt(fases.find((f) => f["id"] === e["fase_id"])?.["nombre"]), fase_desde: txt(e["fase_desde"]),
      fases: fases.map((f) => String(f["nombre"])),
      proximos: (db["eventos"] ?? []).filter((v) => v["expediente_id"] === e["id"] && String(v["inicio"]) >= ahoraISO)
        .sort((a, b) => String(a["inicio"]).localeCompare(String(b["inicio"]))).slice(0, 5)
        .map((v) => ({ titulo: String(v["titulo"]), inicio: String(v["inicio"]), tipo: String(v["tipo"] ?? ""), modalidad: txt(v["modalidad"]) })),
    })),
    documentos: (db["documentos"] ?? []).filter((d) => (d["visible_cliente"] || d["subido_por_cliente"]) && (expIds.has(d["expediente_id"]) || d["cliente_id"] === acc["cliente_id"]))
      .map((d) => ({ id: String(d["id"]), nombre: String(d["nombre"]), expediente_id: txt(d["expediente_id"]), created_at: String(d["created_at"]),
        tamano: d["tamano"] == null ? null : Number(d["tamano"]), mime_type: txt(d["mime_type"]), subido_por_cliente: !!d["subido_por_cliente"] })),
    mensajes: (db["mensajes_cliente"] ?? []).filter((m) => m["cliente_id"] === acc["cliente_id"])
      .sort((a, b) => String(a["created_at"]).localeCompare(String(b["created_at"])))
      .map((m) => ({ id: String(m["id"]), autor: m["autor"] === "cliente" ? "cliente" : "estudio", cuerpo: String(m["cuerpo"]), created_at: String(m["created_at"]), expediente_id: txt(m["expediente_id"]) })),
    cuenta: (db["honorarios"] ?? []).filter((h) => h["cliente_id"] === acc["cliente_id"]).map((h) => ({
      concepto: String(h["concepto"]), moneda: String(h["moneda"] ?? "PEN"), total: Number(h["monto_total"] ?? 0),
      pagado: pagos.filter((p) => p["honorario_id"] === h["id"]).reduce((a, p) => a + Number(p["monto"] ?? 0), 0),
      cuotas: (db["cuotas"] ?? []).filter((c) => c["honorario_id"] === h["id"]).map((c) => ({ numero: Number(c["numero"]), monto: Number(c["monto"]), vence: String(c["fecha_vencimiento"]) })),
    })),
  };
}

function agendaPublica(db: DB, est: Row) {
  const disp = (db["disponibilidad"] ?? []).filter((d) => d["estudio_id"] === est["id"]);
  const ids = [...new Set(disp.map((d) => String(d["user_id"])))];
  const perfil = (id: string) => (db["profiles"] ?? []).find((p) => p["id"] === id);
  const ocupado = [
    ...(db["citas"] ?? []).filter((c) => c["estudio_id"] === est["id"] && (c["estado"] === "pendiente" || c["estado"] === "confirmada"))
      .map((c) => ({ user_id: String(c["user_id"]), inicio: String(c["inicio"]), fin: String(c["fin"]) })),
    ...(db["eventos"] ?? []).filter((e) => e["estudio_id"] === est["id"] && e["responsable_id"])
      .map((e) => ({ user_id: String(e["responsable_id"]), inicio: String(e["inicio"]), fin: String(e["fin"] ?? new Date(Date.parse(String(e["inicio"])) + 3_600_000).toISOString()) })),
  ];
  return {
    nombre: String(est["nombre"]), duracion: Number(est["agenda_duracion_min"] ?? 30), anticipacion_horas: Number(est["agenda_anticipacion_horas"] ?? 24),
    abogados: ids.map((id) => ({ id, nombre: String(perfil(id)?.["nombre_completo"] ?? "Abogado"),
      franjas: disp.filter((d) => d["user_id"] === id).map((d) => ({ dia: Number(d["dia_semana"]), desde: String(d["hora_inicio"]).slice(0, 5), hasta: String(d["hora_fin"]).slice(0, 5) })) })),
    ocupado,
  };
}

/** Lectura directa del almacén (para el portal y el asistente). */
export function leerDB(): DB { return leer(); }
export function guardarDB(db: DB) { guardar(db); }
export { uid as nuevoId };

const noDisponible = { message: "No disponible en el modo prueba" };
const listeners = new Set<(e: string, s: unknown) => void>();

export const demoClient = {
  from: (t: string) => new Query(t),
  rpc: (n: string, a?: Row) => Promise.resolve(rpc(n, a)),
  auth: {
    getUser: async () => ({ data: { user: demoActivo() ? demoUser : null }, error: null }),
    getSession: async () => ({ data: { session: demoActivo() ? demoSession : null }, error: null }),
    signInAnonymously: async () => { activarDemo(); return { data: { user: demoUser, session: demoSession }, error: null }; },
    signOut: async () => { salirDemo(); listeners.forEach((l) => l("SIGNED_OUT", null)); return { error: null }; },
    onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    },
    updateUser: async () => ({ data: { user: demoUser }, error: null }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: noDisponible }),
    signUp: async () => ({ data: { user: null, session: null }, error: noDisponible }),
    resetPasswordForEmail: async () => ({ data: null, error: noDisponible }),
  },
  storage: {
    from: () => ({
      upload: async (path: string, file: Blob) => {
        try { await guardarArchivo(path, file); return { data: { path, id: path, fullPath: path }, error: null }; }
        catch (e) { return { data: null, error: e instanceof Error ? e : new Error("No se pudo guardar el archivo") }; }
      },
      uploadToSignedUrl: async (path: string, _token: string, file: Blob) => {
        try { await guardarArchivo(path, file); return { data: { path, fullPath: path }, error: null }; }
        catch (e) { return { data: null, error: e instanceof Error ? e : new Error("No se pudo guardar el archivo") }; }
      },
      remove: async (paths: string[]) => { await borrarArchivos(paths); return { data: [], error: null }; },
      info: async (path: string) => {
        const b = await leerArchivo(path);
        return b ? { data: { size: b.size, contentType: b.type }, error: null } : { data: null, error: new Error("Archivo no encontrado") };
      },
      download: async (path: string) => {
        const b = await leerArchivo(path);
        return b ? { data: b, error: null } : { data: null, error: new Error("Archivo no encontrado en este navegador") };
      },
      createSignedUrl: async (path: string) => {
        const b = await leerArchivo(path);
        return b ? { data: { signedUrl: URL.createObjectURL(b) }, error: null } : { data: null, error: new Error("Archivo no encontrado en este navegador") };
      },
      list: async () => ({ data: [], error: null }),
    }),
  },
  functions: { invoke: async () => ({ data: null, error: noDisponible }) },
  channel: () => {
    const ch = { on: () => ch, subscribe: () => ch, unsubscribe: () => {} };
    return ch;
  },
  removeChannel: () => {},
};
