// Reglas y catálogos específicos del Perú usados en todo Kevelegal.

export const DEPARTAMENTOS = [
  "Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca", "Callao", "Cusco",
  "Huancavelica", "Huánuco", "Ica", "Junín", "La Libertad", "Lambayeque", "Lima", "Loreto",
  "Madre de Dios", "Moquegua", "Pasco", "Piura", "Puno", "San Martín", "Tacna", "Tumbes", "Ucayali",
] as const;

// Cortes Superiores de Justicia (distritos judiciales) del Poder Judicial.
export const DISTRITOS_JUDICIALES = [
  "Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca", "Callao", "Cañete",
  "Cusco", "Del Santa", "Huancavelica", "Huánuco", "Huaura", "Ica", "Junín", "La Libertad",
  "Lambayeque", "Lima", "Lima Este", "Lima Norte", "Lima Sur", "Loreto", "Madre de Dios",
  "Moquegua", "Pasco", "Piura", "Puente Piedra - Ventanilla", "Puno", "San Martín", "Selva Central",
  "Sullana", "Tacna", "Tumbes", "Ucayali",
] as const;

export const MATERIAS = [
  { value: "civil", label: "Civil" },
  { value: "penal", label: "Penal" },
  { value: "laboral", label: "Laboral" },
  { value: "familia", label: "Familia" },
  { value: "constitucional", label: "Constitucional" },
  { value: "contencioso_administrativo", label: "Contencioso administrativo" },
  { value: "comercial", label: "Comercial" },
  { value: "tributario", label: "Tributario" },
  { value: "administrativo", label: "Administrativo" },
  { value: "arbitraje", label: "Arbitraje" },
  { value: "otro", label: "Otro" },
] as const;

export const VIAS = [
  { value: "judicial", label: "Judicial" },
  { value: "fiscal", label: "Fiscal" },
  { value: "administrativa", label: "Administrativa" },
  { value: "arbitral", label: "Arbitral" },
  { value: "extrajudicial", label: "Extrajudicial" },
] as const;

export const ESTADOS_EXPEDIENTE = [
  { value: "en_tramite", label: "En trámite" },
  { value: "suspendido", label: "Suspendido" },
  { value: "concluido", label: "Concluido" },
  { value: "archivado", label: "Archivado" },
] as const;

export const ROLES_PARTE = [
  "Demandante", "Demandado", "Denunciante", "Denunciado", "Agraviado", "Imputado",
  "Actor civil", "Tercero civilmente responsable", "Tercero", "Litisconsorte", "Solicitante",
] as const;

export const METODOS_PAGO = [
  { value: "transferencia", label: "Transferencia" },
  { value: "deposito", label: "Depósito" },
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
] as const;

export const COMPROBANTES = [
  { value: "ninguno", label: "Sin comprobante" },
  { value: "recibo_honorarios", label: "Recibo por honorarios" },
  { value: "boleta", label: "Boleta" },
  { value: "factura", label: "Factura" },
] as const;

export const MODALIDADES_HONORARIO = [
  { value: "fijo", label: "Monto fijo" },
  { value: "por_hora", label: "Por hora" },
  { value: "cuota_litis", label: "Cuota litis" },
  { value: "iguala", label: "Iguala mensual" },
  { value: "mixto", label: "Mixto" },
] as const;

export const CATEGORIAS_GASTO = [
  { value: "tasas_judiciales", label: "Tasas judiciales" },
  { value: "cedulas", label: "Cédulas de notificación" },
  { value: "copias", label: "Copias y aranceles" },
  { value: "notaria", label: "Notaría" },
  { value: "registros", label: "Registros públicos (SUNARP)" },
  { value: "movilidad", label: "Movilidad" },
  { value: "peritos", label: "Peritos" },
  { value: "otros", label: "Otros" },
] as const;

export const TIPOS_EVENTO = [
  { value: "audiencia", label: "Audiencia" },
  { value: "informe_oral", label: "Informe oral" },
  { value: "diligencia", label: "Diligencia" },
  { value: "reunion", label: "Reunión" },
  { value: "otro", label: "Otro" },
] as const;

export function labelOf(list: readonly { value: string; label: string }[], value?: string | null) {
  return list.find((i) => i.value === value)?.label ?? value ?? "—";
}

// ---------- Documentos de identidad ----------

export function validarDNI(dni: string): boolean {
  return /^\d{8}$/.test(dni.trim());
}

/** RUC: 11 dígitos, prefijo válido (10, 15, 16, 17, 20) y dígito verificador SUNAT. */
export function validarRUC(ruc: string): boolean {
  const r = ruc.trim();
  if (!/^\d{11}$/.test(r)) return false;
  if (!["10", "15", "16", "17", "20"].includes(r.slice(0, 2))) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(r[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 10) dv = 0;
  if (dv === 11) dv = 1;
  return dv === Number(r[10]);
}

export function validarCE(ce: string): boolean {
  return /^[A-Za-z0-9]{9,12}$/.test(ce.trim());
}

export function validarDocumento(tipo: string, numero: string): string | null {
  if (!numero.trim()) return "Ingrese el número de documento";
  if (tipo === "DNI" && !validarDNI(numero)) return "El DNI debe tener 8 dígitos";
  if (tipo === "RUC" && !validarRUC(numero)) return "RUC inválido (11 dígitos y dígito verificador)";
  if (tipo === "CE" && !validarCE(numero)) return "El carné de extranjería debe tener 9 a 12 caracteres";
  if (tipo === "PASAPORTE" && !/^[A-Za-z0-9]{6,15}$/.test(numero.trim())) return "Pasaporte inválido";
  return null;
}

/** Formato del Poder Judicial: 00123-2024-0-1801-JR-CI-01 */
export const FORMATO_EXPEDIENTE_PJ = /^\d{5}-\d{4}-\d{1,2}-\d{4}-[A-Z]{2}-[A-Z]{2}-\d{2}$/;

export function esNumeroExpedientePJ(numero: string): boolean {
  return FORMATO_EXPEDIENTE_PJ.test(numero.trim().toUpperCase());
}

// ---------- Moneda ----------

export function formatSoles(monto: number | string | null | undefined, moneda: string = "PEN") {
  const n = Number(monto ?? 0);
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda }).format(n);
}

// ---------- Feriados y días hábiles ----------

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Domingo de Pascua (algoritmo de Meeus/Butcher). */
function pascua(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export type Feriado = { fecha: string; nombre: string };

/** Feriados nacionales no laborables del Perú (sector público y privado). */
export function feriadosNacionales(year: number): Feriado[] {
  const p = pascua(year);
  const jueves = new Date(p);
  jueves.setDate(p.getDate() - 3);
  const viernes = new Date(p);
  viernes.setDate(p.getDate() - 2);
  const fijo = (m: number, d: number, nombre: string): Feriado => ({
    fecha: `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    nombre,
  });
  return [
    fijo(1, 1, "Año Nuevo"),
    { fecha: iso(jueves), nombre: "Jueves Santo" },
    { fecha: iso(viernes), nombre: "Viernes Santo" },
    fijo(5, 1, "Día del Trabajo"),
    fijo(6, 7, "Batalla de Arica y Día de la Bandera"),
    fijo(6, 29, "San Pedro y San Pablo"),
    fijo(7, 23, "Día de la Fuerza Aérea del Perú"),
    fijo(7, 28, "Fiestas Patrias"),
    fijo(7, 29, "Fiestas Patrias"),
    fijo(8, 6, "Batalla de Junín"),
    fijo(8, 30, "Santa Rosa de Lima"),
    fijo(10, 8, "Combate de Angamos"),
    fijo(11, 1, "Todos los Santos"),
    fijo(12, 8, "Inmaculada Concepción"),
    fijo(12, 9, "Batalla de Ayacucho"),
    fijo(12, 25, "Navidad"),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function esFeriado(fecha: Date, extras: string[] = []): Feriado | undefined {
  const f = iso(fecha);
  if (extras.includes(f)) return { fecha: f, nombre: "Día inhábil" };
  return feriadosNacionales(fecha.getFullYear()).find((x) => x.fecha === f);
}

export function esDiaHabil(fecha: Date, extras: string[] = []): boolean {
  const dow = fecha.getDay();
  if (dow === 0 || dow === 6) return false;
  return !esFeriado(fecha, extras);
}

/**
 * Calcula el vencimiento de un plazo en días hábiles.
 * El cómputo empieza al día siguiente de la notificación y excluye sábados,
 * domingos, feriados nacionales y los días inhábiles adicionales indicados.
 */
export function calcularVencimiento(notificacion: Date, diasHabiles: number, extras: string[] = []): Date {
  const d = new Date(notificacion.getFullYear(), notificacion.getMonth(), notificacion.getDate());
  let contados = 0;
  while (contados < diasHabiles) {
    d.setDate(d.getDate() + 1);
    if (esDiaHabil(d, extras)) contados++;
  }
  return d;
}

export function toISODate(d: Date) {
  return iso(d);
}

/** Parse YYYY-MM-DD as a local date (avoids UTC shift). */
export function parseISODate(s: string): Date {
  const [y = 1970, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Plazo interno de seguridad: retrocede `dias` hábiles desde el vencimiento legal,
 * para presentar con margen ante caídas de sistemas o firmas pendientes.
 */
export function plazoInterno(vencimiento: Date, dias = 2, extras: string[] = []): Date {
  const d = new Date(vencimiento);
  let n = 0;
  while (n < dias) {
    d.setDate(d.getDate() - 1);
    if (esDiaHabil(d, extras)) n++;
  }
  return d;
}
