import { useRouteContext } from "@tanstack/react-router";

const STORAGE_KEY = "kevelegal.estudio";

export function getEstudioPreferido(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setEstudioPreferido(id: string) {
  window.localStorage.setItem(STORAGE_KEY, id);
}

/** Current studio, role and permissions. Only usable inside the studio area. */
export function useEstudio() {
  const ctx = useRouteContext({ from: "/_authenticated/_estudio" });
  const rol = ctx.rol;
  return {
    estudio: ctx.estudio,
    estudioId: ctx.estudio.id,
    rol,
    membresias: ctx.membresias,
    user: ctx.user,
    puedeVerFinanzas: rol === "admin" || rol === "abogado",
    puedeEliminar: rol === "admin" || rol === "abogado",
    esAdmin: rol === "admin",
  };
}
