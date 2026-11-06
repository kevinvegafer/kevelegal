import { useEstudio } from '@/hooks/use-estudio';
import { Button } from '@/components/ui/button';
export const OPCIONES_RECORDATORIO = [15, 30, 60, 120, 1440, 2880] as const;
export function etiquetaRecordatorio(n: number): string {
  return n >= 1440 ? `${n / 1440} día${n === 1440 ? '' : 's'}` : n >= 60 ? `${n / 60} h` : `${n} min`;
}
export function valoresRecordatorio(json: unknown, tipo: string): number[] {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  const valor: unknown = Reflect.get(json, tipo);
  return Array.isArray(valor) ? valor.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0) : [];
}
export function RecordatoriosSelect({ value, onChange, tipo }: {
  value: number[] | null; onChange: (value: number[] | null) => void; tipo: string;
}) {
  const { estudio } = useEstudio();
  const defaults = valoresRecordatorio(estudio.recordatorios_evento, tipo);
  const actual = value ?? defaults;
  return <div className="grid gap-2">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Recordatorios del evento">
      <Button type="button" size="sm" variant={value === null ? 'default' : 'outline'} aria-pressed={value === null} onClick={() => onChange(null)}>Usar por defecto</Button>
      <Button type="button" size="sm" variant={value?.length === 0 ? 'default' : 'outline'} aria-pressed={value?.length === 0} onClick={() => onChange([])}>Sin recordatorios</Button>
      {OPCIONES_RECORDATORIO.map(n => <Button type="button" size="sm" key={n} aria-pressed={actual.includes(n)} variant={actual.includes(n) ? 'default' : 'outline'} onClick={() => onChange(actual.includes(n) ? actual.filter(x => x !== n) : [...actual,n].sort((a,b) => a-b))}>{etiquetaRecordatorio(n)}</Button>)}
    </div>
    <p className="text-xs text-muted-foreground">Por defecto del estudio: {defaults.map(etiquetaRecordatorio).join(', ') || 'sin recordatorios'}.</p>
  </div>;
}
