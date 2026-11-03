import { setEstudioPreferido } from "@/hooks/use-estudio";
import { activarDemo } from "@/lib/demo-client";

/**
 * Modo prueba: funciona solo en el navegador, sin servidor ni base de datos.
 * Crea un estudio con datos de ejemplo guardados en este dispositivo.
 */
export async function entrarModoPrueba() {
  const estudioId = activarDemo();
  setEstudioPreferido(estudioId);
  return estudioId;
}
