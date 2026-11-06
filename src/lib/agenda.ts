export interface Franja { dia: number; desde: string; hasta: string }
export interface Ocupado { inicio: string; fin: string }
export interface DiaAgenda { fecha: string; horarios: string[] }
const MIN = 60_000;
const DIA = 1440 * MIN;
const LIMA = 5 * 60 * MIN;
export function fechaLima(date: Date): string {
  return new Date(date.getTime() - LIMA).toISOString().slice(0, 10);
}
export function formatoLima(iso: string, horaSolo = false): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    ...(horaSolo ? { hour: '2-digit', minute: '2-digit' } as const
      : { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' } as const),
  }).format(new Date(iso));
}
export function generarHorarios({ franjas, ocupado, duracionMin, anticipacionHoras, desde, dias, feriados }: {
  franjas: readonly Franja[]; ocupado: readonly Ocupado[]; duracionMin: number;
  anticipacionHoras: number; desde: Date; dias: number; feriados: readonly string[];
}): DiaAgenda[] {
  if (!Number.isFinite(desde.getTime()) || !Number.isInteger(dias) || dias < 0 || dias > 366
    || !Number.isInteger(duracionMin) || duracionMin < 10 || duracionMin > 240
    || !Number.isFinite(anticipacionHoras) || anticipacionHoras < 0) return [];
  const inicioDia = Date.parse(`${fechaLima(desde)}T00:00:00-05:00`);
  const limite = desde.getTime() + anticipacionHoras * 60 * MIN;
  const festivos = new Set(feriados);
  const reservas = ocupado.map(o => [Date.parse(o.inicio), Date.parse(o.fin)] as const);
  const minutos = (hora: string): number => {
    if (!/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(hora)) return NaN;
    return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
  };
  const resultado: DiaAgenda[] = [];
  for (let n = 0; n < dias; n++) {
    const base = inicioDia + n * DIA;
    const fecha = fechaLima(new Date(base));
    if (festivos.has(fecha)) continue;
    const dia = new Date(base - LIMA).getUTCDay();
    const slots = new Set<number>();
    for (const franja of franjas.filter(f => f.dia === dia)) {
      const fin = minutos(franja.hasta);
      for (let m = minutos(franja.desde); m + duracionMin <= fin; m += duracionMin) {
        const inicio = base + m * MIN;
        const final = inicio + duracionMin * MIN;
        if (inicio >= limite && !reservas.some(([a, b]) => a < final && b > inicio)) slots.add(inicio);
      }
    }
    if (slots.size) resultado.push({ fecha, horarios: [...slots].sort((a,b) => a-b).map(t => new Date(t).toISOString()) });
  }
  return resultado;
}
