/**
 * Modo prueba local: imita el cliente de datos usando solo el navegador
 * (localStorage). No se conecta a ningún servidor.
 */
const FLAG = "kevelegal-demo";
const DB_KEY = "kevelegal-demo-db";
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_ESTUDIO_ID = "00000000-0000-4000-8000-0000000000e1";

type Row = Record<string, unknown>;
type DB = Record<string, Row[]>;

export function demoActivo() {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function hoy(dias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function semilla(): DB {
  const now = new Date().toISOString();
  const base = { created_at: now, updated_at: now, estudio_id: DEMO_ESTUDIO_ID };
  const c1 = uid(), c2 = uid(), e1 = uid(), e2 = uid();
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
    expedientes: [
      { ...base, id: e1, cliente_id: c1, titulo: "Alimentos — Quispe", materia: "Familia", via: "judicial", estado: "activo", numero_expediente: "01234-2026-0-1801-JP-FC-01", distrito_judicial: "Lima", responsable_id: DEMO_USER_ID, campos_extra: {}, fase_id: null, fase_desde: now, fecha_inicio: hoy(-30) },
      { ...base, id: e2, cliente_id: c2, titulo: "Cobro de soles — Inversiones Andinas", materia: "Civil", via: "judicial", estado: "activo", numero_expediente: null, distrito_judicial: "Lima", responsable_id: DEMO_USER_ID, campos_extra: {}, fase_id: null, fase_desde: now, fecha_inicio: hoy(-10) },
    ],
    plazos: [
      { ...base, id: uid(), expediente_id: e1, titulo: "Contestar demanda", tipo: "procesal", estado: "pendiente", prioridad: "alta", fecha_vencimiento: hoy(3), asignado_a: DEMO_USER_ID, desfase_dias: 0, parent_id: null, depende_de: null, completado_at: null },
      { ...base, id: uid(), expediente_id: e2, titulo: "Presentar escrito de subsanación", tipo: "procesal", estado: "pendiente", prioridad: "media", fecha_vencimiento: hoy(7), asignado_a: DEMO_USER_ID, desfase_dias: 0, parent_id: null, depende_de: null, completado_at: null },
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
  window.localStorage.removeItem(FLAG);
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
        const existing = this.mode === "upsert" && p["id"] ? rows.find((r) => r["id"] === p["id"]) : undefined;
        if (existing) { Object.assign(existing, p, { updated_at: now }); result.push(existing); continue; }
        const r: Row = { id: uid(), created_at: now, updated_at: now, created_by: DEMO_USER_ID, ...p };
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
  if (name === "mis_avisos") return { data: [], error: null };
  return { data: null, error: { message: "Esta función no está disponible en el modo prueba" } };
}

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
      upload: async () => ({ data: null, error: { message: "Subir archivos no está disponible en el modo prueba" } }),
      remove: async () => ({ data: [], error: null }),
      info: async () => ({ data: null, error: noDisponible }),
      download: async () => ({ data: null, error: noDisponible }),
      createSignedUrl: async () => ({ data: null, error: noDisponible }),
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
