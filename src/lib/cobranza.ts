export type CuotaBase = { numero: number; monto: number; fecha_vencimiento: string };
const centimos = (v: number) => {
  if (!Number.isFinite(v) || v < 0) throw new Error("Importe inválido");
  return Math.round(v * 100);
};
export function estadoCuotas<T extends CuotaBase>(
  cuotas: readonly T[],
  totalPagado: number,
  hoyISO: string,
) {
  let disponible = centimos(totalPagado);
  return [...cuotas]
    .sort((a, b) => a.numero - b.numero || a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))
    .map((c) => {
      const monto = centimos(c.monto),
        aplicado = Math.min(monto, disponible);
      disponible -= aplicado;
      const saldo = (monto - aplicado) / 100;
      const estado: "pagada" | "parcial" | "pendiente" | "vencida" = !saldo
        ? "pagada"
        : c.fecha_vencimiento < hoyISO
          ? "vencida"
          : aplicado
            ? "parcial"
            : "pendiente";
      return { ...c, pagado: aplicado / 100, saldo, estado };
    });
}
export function generarCuotas(
  total: number,
  n: number,
  primeraFechaISO: string,
  frecuencia: "mensual" | "quincenal",
) {
  const cents = centimos(total);
  const [y, m, d] = primeraFechaISO.split("-").map(Number);
  if (!y || !m || !d || !/^\d{4}-\d{2}-\d{2}$/.test(primeraFechaISO))
    throw new Error("Fecha inválida");
  const inicio = new Date(Date.UTC(y, m - 1, d));
  if (inicio.toISOString().slice(0, 10) !== primeraFechaISO) throw new Error("Fecha inválida");
  if (!Number.isInteger(n) || n < 1 || n > 360 || cents < n)
    throw new Error("Número de cuotas inválido");
  const base = Math.floor(cents / n);
  return Array.from({ length: n }, (_, i) => {
    let fecha: Date;
    if (frecuencia === "mensual") {
      const fin = new Date(Date.UTC(y, m + i, 0)).getUTCDate();
      fecha = new Date(Date.UTC(y, m - 1 + i, Math.min(d, fin)));
    } else fecha = new Date(Date.UTC(y, m - 1, d + i * 15));
    return {
      numero: i + 1,
      monto: (i === n - 1 ? cents - base * (n - 1) : base) / 100,
      fecha_vencimiento: fecha.toISOString().slice(0, 10),
    };
  });
}
export function segundosAMonto(segundos: number, tarifa: number) {
  if (!Number.isFinite(segundos) || segundos < 0) throw new Error("Duración inválida");
  centimos(tarifa);
  return Math.round(((segundos / 3600) * tarifa + Number.EPSILON) * 100) / 100;
}
export function formatDuracion(segundos: number) {
  const minutos = Math.floor(Math.max(0, segundos) / 60);
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")} min`;
}
export function hoyLima() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
