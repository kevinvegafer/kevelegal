export const ESTADO_EXP_VARIANT = {
  en_tramite: "primary",
  suspendido: "warning",
  concluido: "success",
  archivado: "muted",
} as const;

export function varianteExpediente(estado: string) {
  return ESTADO_EXP_VARIANT[estado as keyof typeof ESTADO_EXP_VARIANT] ?? "muted";
}
