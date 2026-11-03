import { supabase } from "@/integrations/supabase/client";
import { setEstudioPreferido } from "@/hooks/use-estudio";

/**
 * Modo prueba: inicia una sesión anónima (sin registro) y crea un estudio
 * vacío propio para explorar Kevelegal. Los datos quedan aislados como
 * cualquier otro estudio y se pierden al cerrar sesión.
 */
export async function entrarModoPrueba() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("No se pudo iniciar el modo prueba");

  const { data: miembros } = await supabase
    .from("estudio_miembros")
    .select("estudio_id")
    .eq("user_id", data.user.id)
    .limit(1);

  let estudioId = miembros?.[0]?.estudio_id;
  if (!estudioId) {
    const res = await supabase.rpc("crear_estudio", { _nombre: "Estudio de prueba", _departamento: "Lima" });
    if (res.error) throw res.error;
    estudioId = res.data as string;
  }
  setEstudioPreferido(estudioId);
  return estudioId;
}
