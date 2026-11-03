import { calcularVencimiento, toISODate } from "./peru";

type TareaBase = {
  id: string;
  estado: string;
  depende_de: string | null;
  desfase_dias: number;
  parent_id: string | null;
};

/**
 * When a task is completed, its pending dependents move automatically:
 * new due date = completion day + `desfase_dias` business days
 * (0 → same day). Only direct dependents move; their own dependents move
 * when they are completed in turn.
 */
export function reprogramarDependientes<T extends TareaBase>(
  completadaId: string,
  todas: readonly T[],
  completadaEl: Date,
  feriadosExtra: string[] = [],
): { id: string; fecha_vencimiento: string }[] {
  return todas
    .filter((t) => t.depende_de === completadaId && t.estado === "pendiente")
    .map((t) => ({
      id: t.id,
      fecha_vencimiento:
        t.desfase_dias > 0
          ? toISODate(calcularVencimiento(completadaEl, t.desfase_dias, feriadosExtra))
          : toISODate(completadaEl),
    }));
}

/** A task is blocked while the task it depends on is still pending. */
export function estaBloqueada<T extends TareaBase>(t: T, todas: readonly T[]): T | undefined {
  if (!t.depende_de) return undefined;
  const previa = todas.find((x) => x.id === t.depende_de);
  return previa && previa.estado === "pendiente" ? previa : undefined;
}

/** Would making `id` depend on / be a child of `candidato` create a cycle? */
export function creaCiclo<T extends TareaBase>(
  id: string,
  candidato: string,
  todas: readonly T[],
  campo: "depende_de" | "parent_id",
): boolean {
  let actual: string | null = candidato;
  const vistos = new Set<string>();
  while (actual) {
    if (actual === id) return true;
    if (vistos.has(actual)) return true;
    vistos.add(actual);
    const nodo = todas.find((x) => x.id === actual);
    actual = nodo ? nodo[campo] : null;
  }
  return false;
}

/** Orders tasks so each subtask follows its parent (one level shown nested). */
export function agruparSubtareas<T extends TareaBase>(lista: readonly T[]): { tarea: T; hijas: T[] }[] {
  const ids = new Set(lista.map((t) => t.id));
  const raiz = lista.filter((t) => !t.parent_id || !ids.has(t.parent_id));
  return raiz.map((tarea) => ({ tarea, hijas: lista.filter((h) => h.parent_id === tarea.id) }));
}
