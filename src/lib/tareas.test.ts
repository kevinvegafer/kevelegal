import { describe, expect, it } from "vitest";
import { agruparSubtareas, creaCiclo, estaBloqueada, reprogramarDependientes } from "./tareas";
import { parseISODate } from "./peru";

const t = (id: string, extra: Partial<{ estado: string; depende_de: string | null; desfase_dias: number; parent_id: string | null }> = {}) => ({
  id,
  estado: "pendiente",
  depende_de: null,
  desfase_dias: 0,
  parent_id: null,
  ...extra,
});

describe("dependencias entre tareas", () => {
  it("al completar una tarea, la dependiente se mueve N días hábiles después", () => {
    // Viernes 24 jul 2026 + 3 días hábiles: 27 lun, (28 y 29 jul feriados), 30 jue, 31 vie
    const todas = [t("a"), t("b", { depende_de: "a", desfase_dias: 3 })];
    expect(reprogramarDependientes("a", todas, parseISODate("2026-07-24"))).toEqual([
      { id: "b", fecha_vencimiento: "2026-07-31" },
    ]);
  });

  it("con desfase 0 la dependiente vence el mismo día", () => {
    const todas = [t("a"), t("b", { depende_de: "a" })];
    expect(reprogramarDependientes("a", todas, parseISODate("2026-03-10"))).toEqual([
      { id: "b", fecha_vencimiento: "2026-03-10" },
    ]);
  });

  it("no mueve dependientes ya completadas", () => {
    const todas = [t("a"), t("b", { depende_de: "a", estado: "completado", desfase_dias: 2 })];
    expect(reprogramarDependientes("a", todas, parseISODate("2026-03-10"))).toEqual([]);
  });

  it("una tarea está bloqueada mientras la previa siga pendiente", () => {
    const a = t("a");
    const b = t("b", { depende_de: "a" });
    expect(estaBloqueada(b, [a, b])?.id).toBe("a");
    expect(estaBloqueada(b, [{ ...a, estado: "completado" }, b])).toBeUndefined();
  });

  it("detecta ciclos de dependencia", () => {
    const todas = [t("a", { depende_de: "b" }), t("b", { depende_de: "c" }), t("c")];
    expect(creaCiclo("c", "a", todas, "depende_de")).toBe(true);
    expect(creaCiclo("c", "x", todas, "depende_de")).toBe(false);
  });

  it("agrupa subtareas bajo su tarea madre", () => {
    const g = agruparSubtareas([t("a"), t("a1", { parent_id: "a" }), t("b")]);
    expect(g.map((x) => [x.tarea.id, x.hijas.map((h) => h.id)])).toEqual([
      ["a", ["a1"]],
      ["b", []],
    ]);
  });
});
