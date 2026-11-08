/**
 * Motor de búsqueda global (la lupa).
 *
 * Funciona sobre un índice precalculado: el texto de cada registro se normaliza una sola vez
 * (sin tildes, minúsculas, sin signos) y cada consulta solo compara cadenas ya preparadas.
 * Así se mantiene rápido con decenas de miles de registros.
 *
 * Reglas:
 * - Todas las palabras de la consulta deben aparecer (en cualquier campo del registro).
 * - Ignora tildes, mayúsculas y signos: "huaman" encuentra "Huamán", "01234 2026" encuentra
 *   "01234-2026-0-1801-JP-FC-01" y "20512345678" encuentra "205 123 456 78".
 * - "frase exacta" entre comillas, -palabra para excluir, y prefijos de tipo
 *   (exp:, cli:, plazo:, tarea:, evento:, doc:, parte:, ir:) para buscar solo en un tipo.
 * - Tolera un error de tipeo en palabras de 4+ letras (dos en 8+), con menor puntaje.
 */

export const TIPOS_BUSQUEDA = [
  "expediente",
  "cliente",
  "plazo",
  "tarea",
  "evento",
  "documento",
  "parte",
  "pagina",
] as const;
export type TipoBusqueda = (typeof TIPOS_BUSQUEDA)[number];

export type Destino =
  | { ruta: "/expedientes/$id"; id: string; tab?: TabExpediente | undefined }
  | { ruta: "/clientes/$id"; id: string }
  | { ruta: "/calendario"; dia?: string | undefined }
  | { ruta: "/plazos" }
  | { ruta: "pagina"; to: string };

export type TabExpediente = "plazos" | "tareas" | "audiencias" | "partes" | "bitacora" | "documentos" | "economico";

export type Campo = { texto: string | null | undefined; peso: number };

export type Entrada = {
  /** Único en todo el índice: tipo + id. */
  clave: string;
  tipo: TipoBusqueda;
  titulo: string;
  subtitulo?: string | undefined;
  /** Texto corto a la derecha (número de expediente, documento, fecha…). */
  detalle?: string | undefined;
  /** Etiqueta de estado (Vencido, Concluido…). */
  estado?: { texto: string; tono: "primary" | "warning" | "success" | "muted" | "destructive" } | undefined;
  campos: Campo[];
  destino: Destino;
  /** 0..1: sube en el orden lo reciente o activo. */
  relevancia?: number | undefined;
};

type CampoIndexado = { norm: string; compacto: string; palabras: string[]; peso: number };
export type EntradaIndexada = Entrada & { _campos: CampoIndexado[] };
export type Indice = { entradas: EntradaIndexada[]; porTipo: Map<TipoBusqueda, EntradaIndexada[]> };

const MARCAS = /\p{M}/gu;
const NO_ALFANUM = /[^\p{L}\p{N}]+/gu;

/** Minúsculas, sin tildes, signos convertidos en espacios simples. */
export function normalizar(s: string | null | undefined): string {
  if (!s) return "";
  return s.normalize("NFD").replace(MARCAS, "").toLowerCase().replace(NO_ALFANUM, " ").trim();
}

/** Igual que normalizar pero sin espacios: para números de documento y de expediente. */
export function compactar(s: string | null | undefined): string {
  return normalizar(s).replace(/ /g, "");
}

export function crearIndice(entradas: Entrada[]): Indice {
  const porTipo = new Map<TipoBusqueda, EntradaIndexada[]>();
  const lista: EntradaIndexada[] = new Array(entradas.length);
  for (let i = 0; i < entradas.length; i++) {
    const e = entradas[i]!;
    const campos: CampoIndexado[] = [];
    for (const c of e.campos) {
      const norm = normalizar(c.texto);
      if (!norm) continue;
      campos.push({ norm, compacto: norm.replace(/ /g, ""), palabras: norm.split(" "), peso: c.peso });
    }
    const ix: EntradaIndexada = { ...e, _campos: campos };
    lista[i] = ix;
    const arr = porTipo.get(e.tipo);
    if (arr) arr.push(ix);
    else porTipo.set(e.tipo, [ix]);
  }
  return { entradas: lista, porTipo };
}

// ---------- Consulta ----------

const PREFIJOS: Record<string, TipoBusqueda> = {
  exp: "expediente", expediente: "expediente", caso: "expediente",
  cli: "cliente", cliente: "cliente",
  plazo: "plazo", plazos: "plazo",
  tarea: "tarea", tareas: "tarea",
  evento: "evento", audiencia: "evento", cita: "evento",
  doc: "documento", documento: "documento",
  parte: "parte", partes: "parte",
  ir: "pagina", pagina: "pagina",
};

export type Consulta = {
  /** Palabras o frases (normalizadas) que deben aparecer todas. */
  terminos: string[];
  /** Palabras o frases que no deben aparecer. */
  excluir: string[];
  tipo: TipoBusqueda | null;
  vacia: boolean;
};

export function analizarConsulta(texto: string): Consulta {
  const terminos: string[] = [];
  const excluir: string[] = [];
  let tipo: TipoBusqueda | null = null;
  const re = /(-?)"([^"]*)"?|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    if (m[2] !== undefined) {
      const n = normalizar(m[2]);
      if (n) (m[1] ? excluir : terminos).push(n);
      continue;
    }
    let palabra = m[3]!;
    const pref = /^([a-záéíóú]+):(.*)$/i.exec(palabra);
    if (pref) {
      const t = PREFIJOS[normalizar(pref[1])];
      if (t) {
        tipo = t;
        palabra = pref[2] ?? "";
        if (!palabra) continue;
      }
    }
    if (palabra.startsWith("-") && palabra.length > 1) {
      const n = normalizar(palabra.slice(1));
      if (n) excluir.push(...n.split(" "));
      continue;
    }
    const n = normalizar(palabra);
    if (n) terminos.push(...n.split(" "));
  }
  return { terminos, excluir, tipo, vacia: terminos.length === 0 };
}

/** Distancia de edición (con intercambio de letras vecinas = 1), acotada: devuelve max+1 al pasarse. */
export function distancia(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = new Array<number>(b.length + 1).fill(0);
  let prev = new Array<number>(b.length + 1);
  let cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let minFila = i;
    for (let j = 1; j <= b.length; j++) {
      const ca = a.charCodeAt(i - 1);
      const cb = b.charCodeAt(j - 1);
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (ca === cb ? 0 : 1));
      if (i > 1 && j > 1 && ca === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === cb) v = Math.min(v, prev2[j - 2]! + 1);
      cur[j] = v;
      if (v < minFila) minFila = v;
    }
    if (minFila > max) return max + 1;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return prev[b.length]!;
}

function puntajeTermino(t: string, campos: CampoIndexado[], conErrores: boolean): number {
  const tc = t.includes(" ") ? t.replace(/ /g, "") : t;
  const numerico = /\d/.test(tc);
  let mejor = 0;
  for (const c of campos) {
    let q = 0;
    if (c.norm === t) q = 100;
    else if (c.norm.startsWith(t)) q = 80;
    else if (t.includes(" ") ? c.norm.includes(t) : c.palabras.some((p) => p.startsWith(t))) q = 60;
    else if (c.norm.includes(t)) q = 35;
    else if (numerico && tc.length >= 3 && c.compacto.includes(tc)) q = c.compacto.startsWith(tc) ? 70 : 50;
    else if (conErrores && !numerico && t.length >= 4 && !t.includes(" ")) {
      const max = t.length >= 8 ? 2 : 1;
      for (const p of c.palabras) {
        // Compara contra la palabra completa o su comienzo (para búsquedas a medio escribir).
        if (distancia(t, p, max) <= max || (p.length > t.length && distancia(t, p.slice(0, t.length), max) <= max)) {
          q = 15;
          break;
        }
      }
    }
    const s = q * c.peso;
    if (s > mejor) mejor = s;
  }
  return mejor;
}

function contiene(t: string, campos: CampoIndexado[]) {
  return campos.some((c) => c.norm.includes(t) || (t.length >= 3 && c.compacto.includes(t.replace(/ /g, ""))));
}

export type Resultado = EntradaIndexada & { puntaje: number };
export type Grupo = { tipo: TipoBusqueda; total: number; items: Resultado[] };
export type RespuestaBusqueda = { grupos: Grupo[]; total: number; conErrores: boolean; consulta: Consulta };

export type OpcionesBusqueda = {
  /** Limita a estos tipos (los chips de filtro). */
  tipos?: TipoBusqueda[] | null | undefined;
  /** Máximo de resultados mostrados por tipo. */
  limitePorTipo?: number | undefined;
};

function puntuar(e: EntradaIndexada, c: Consulta, conErrores: boolean): number {
  let total = 0;
  for (const t of c.terminos) {
    const s = puntajeTermino(t, e._campos, conErrores);
    if (s === 0) return 0;
    total += s;
  }
  for (const x of c.excluir) if (contiene(x, e._campos)) return 0;
  return total + (e.relevancia ?? 0) * 40;
}

const colador = new Intl.Collator("es", { sensitivity: "base", numeric: true });
const comparar = (a: string, b: string) => colador.compare(a, b);

/** Los `k` mejores sin ordenar toda la lista cuando es enorme. */
function seleccionarMejores(items: number[], k: number, cmp: (a: number, b: number) => number): number[] {
  if (items.length <= k * 4) return items.sort(cmp).slice(0, k);
  const top: number[] = [];
  for (const it of items) {
    if (top.length < k) {
      top.push(it);
      if (top.length === k) top.sort(cmp);
    } else if (cmp(it, top[k - 1]!) < 0) {
      let j = k - 1;
      while (j > 0 && cmp(it, top[j - 1]!) < 0) j--;
      top.splice(j, 0, it);
      top.pop();
    }
  }
  return top;
}

export function buscar(indice: Indice, texto: string, opciones: OpcionesBusqueda = {}): RespuestaBusqueda {
  const consulta = analizarConsulta(texto);
  const limite = opciones.limitePorTipo ?? 5;
  let tipos: TipoBusqueda[] = opciones.tipos?.length ? opciones.tipos : [...TIPOS_BUSQUEDA];
  if (consulta.tipo) tipos = tipos.includes(consulta.tipo) ? [consulta.tipo] : [];
  if (consulta.vacia) return { grupos: [], total: 0, conErrores: false, consulta };

  const correr = (conErrores: boolean) => {
    const grupos: Grupo[] = [];
    let total = 0;
    for (const tipo of tipos) {
      const lista = indice.porTipo.get(tipo);
      if (!lista) continue;
      // Guarda solo índice + puntaje; los objetos de resultado se crean para los que se muestran.
      const pos: number[] = [];
      const pts: number[] = [];
      for (let i = 0; i < lista.length; i++) {
        const p = puntuar(lista[i]!, consulta, conErrores);
        if (p > 0) {
          pos.push(i);
          pts.push(p);
        }
      }
      if (!pos.length) continue;
      const orden = pos.map((_, k) => k);
      const top = seleccionarMejores(orden, limite, (x, y) => pts[y]! - pts[x]! || comparar(lista[pos[x]!]!.titulo, lista[pos[y]!]!.titulo));
      grupos.push({ tipo, total: pos.length, items: top.map((k) => ({ ...lista[pos[k]!]!, puntaje: pts[k]! })) });
      total += pos.length;
    }
    // Los grupos con la mejor coincidencia van primero.
    grupos.sort((a, b) => (b.items[0]?.puntaje ?? 0) - (a.items[0]?.puntaje ?? 0));
    return { grupos, total };
  };

  let r = correr(false);
  let conErrores = false;
  // Solo si no hay nada exacto se intenta tolerar errores de tipeo (más costoso).
  if (r.total === 0) {
    r = correr(true);
    conErrores = r.total > 0;
  }
  return { ...r, conErrores, consulta };
}

// ---------- Resaltado ----------

/** Rangos [inicio, fin) del texto original donde aparecen los términos buscados. */
export function rangosResaltado(texto: string, terminos: string[]): [number, number][] {
  if (!texto || !terminos.length) return [];
  // Mapa 1:1 carácter original -> carácter normalizado.
  let norm = "";
  const origen: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]!;
    let n = ch.normalize("NFD").replace(MARCAS, "").toLowerCase();
    if (!n || /[^\p{L}\p{N}]/u.test(n)) n = " ";
    for (const k of n) {
      norm += k;
      origen.push(i);
    }
  }
  const rangos: [number, number][] = [];
  for (const t of terminos) {
    if (!t) continue;
    let desde = 0;
    while (desde <= norm.length) {
      const pos = norm.indexOf(t, desde);
      if (pos < 0) break;
      rangos.push([origen[pos]!, origen[pos + t.length - 1]! + 1]);
      desde = pos + t.length;
    }
  }
  rangos.sort((a, b) => a[0] - b[0]);
  const unidos: [number, number][] = [];
  for (const r of rangos) {
    const u = unidos[unidos.length - 1];
    if (u && r[0] <= u[1]) u[1] = Math.max(u[1], r[1]);
    else unidos.push([r[0], r[1]]);
  }
  return unidos;
}
