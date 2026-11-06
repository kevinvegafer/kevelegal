/**
 * Cálculos puros para los gráficos del panel. Las fechas se manejan como
 * cadenas ISO (YYYY-MM-DD) para evitar desfases de zona horaria.
 */

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

export type Mes = { clave: string; etiqueta: string };

/** Últimos `n` meses terminando en el mes de `hoyISO`, del más antiguo al actual. */
export function ultimosMeses(n: number, hoyISO: string): Mes[] {
  const [y, m] = hoyISO.split("-").map(Number) as [number, number];
  const out: Mes[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i;
    const yy = Math.floor(total / 12);
    const mm = total % 12;
    out.push({
      clave: `${yy}-${String(mm + 1).padStart(2, "0")}`,
      etiqueta: `${MESES_CORTOS[mm]}${n > 12 || mm === 0 ? ` ${String(yy).slice(2)}` : ""}`,
    });
  }
  return out;
}

/** Suma `valor` de cada item en el mes de su fecha. Meses sin datos quedan en 0. */
export function sumarPorMes<T>(
  items: readonly T[],
  meses: readonly Mes[],
  fecha: (t: T) => string,
  valor: (t: T) => number = () => 1,
): number[] {
  const idx = new Map(meses.map((m, i) => [m.clave, i]));
  const out = meses.map(() => 0);
  for (const it of items) {
    const i = idx.get(fecha(it).slice(0, 7));
    if (i !== undefined) out[i] = (out[i] ?? 0) + valor(it);
  }
  return out;
}

function addDiasISO(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Lunes de la semana de `iso`. */
export function lunesDe(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
  return addDiasISO(iso, -dow);
}

export type Semana = { inicio: string; fin: string; etiqueta: string };

/** `n` semanas (lunes a domingo) desde la semana de `hoyISO`. */
export function proximasSemanas(n: number, hoyISO: string): Semana[] {
  const base = lunesDe(hoyISO);
  return Array.from({ length: n }, (_, i) => {
    const inicio = addDiasISO(base, i * 7);
    const [, mm, dd] = inicio.split("-").map(Number) as [number, number, number];
    return {
      inicio,
      fin: addDiasISO(inicio, 6),
      etiqueta: i === 0 ? "Esta sem." : `${dd} ${MESES_CORTOS[mm - 1]}`,
    };
  });
}

/** Últimos `n` días terminando en `hoyISO`, del más antiguo a hoy. */
export function ultimosDias(n: number, hoyISO: string): string[] {
  return Array.from({ length: n }, (_, i) => addDiasISO(hoyISO, i - (n - 1)));
}

/** Variación porcentual redondeada; null si no hay base de comparación. */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual === 0 ? 0 : null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

/**
 * Cumplimiento: de los plazos ya vencidos o completados, qué porcentaje se
 * completó a tiempo (completado el día del vencimiento o antes).
 */
export function cumplimientoPlazos(
  plazos: readonly { estado: string; fecha_vencimiento: string; completado_at: string | null }[],
  hoyISO: string,
): { porcentaje: number | null; aTiempo: number; total: number } {
  let aTiempo = 0;
  let total = 0;
  for (const p of plazos) {
    if (p.estado === "completado") {
      total++;
      const dia = p.completado_at ? p.completado_at.slice(0, 10) : p.fecha_vencimiento;
      if (dia <= p.fecha_vencimiento) aTiempo++;
    } else if (p.estado === "pendiente" && p.fecha_vencimiento < hoyISO) {
      total++;
    }
  }
  return { porcentaje: total ? Math.round((aTiempo / total) * 100) : null, aTiempo, total };
}
