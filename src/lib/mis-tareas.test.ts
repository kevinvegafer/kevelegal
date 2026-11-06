import { describe, expect, it } from "vitest";
import { finDeSemana, grupoDe, visiblePara } from "./mis-tareas";

// 2026-11-06 es viernes.
const HOY = "2026-11-06";

describe("grupoDe", () => {
  it("fecha pasada es vencida", () => expect(grupoDe("2026-11-05", HOY)).toBe("vencidas"));
  it("fecha de hoy es hoy", () => expect(grupoDe(HOY, HOY)).toBe("hoy"));
  it("día siguiente es mañana", () => expect(grupoDe("2026-11-07", HOY)).toBe("manana"));
  it("domingo de la misma semana es esta semana", () => expect(grupoDe("2026-11-08", HOY)).toBe("semana"));
  it("lunes siguiente es planificada", () => expect(grupoDe("2026-11-09", HOY)).toBe("planificadas"));
  it("sin fecha es algún día", () => expect(grupoDe(null, HOY)).toBe("algun_dia"));
});

describe("finDeSemana", () => {
  it("un domingo termina ese mismo día", () => expect(finDeSemana("2026-11-08")).toBe("2026-11-08"));
  it("un lunes termina el domingo siguiente", () => expect(finDeSemana("2026-11-02")).toBe("2026-11-08"));
});

describe("visiblePara", () => {
  it("la tarea privada solo la ve su autor", () => {
    expect(visiblePara({ visibilidad: "privada", created_by: "a" }, "a")).toBe(true);
    expect(visiblePara({ visibilidad: "privada", created_by: "a" }, "b")).toBe(false);
  });
  it("la tarea compartida la ve todo el estudio", () => {
    expect(visiblePara({ visibilidad: "estudio", created_by: "a" }, "b")).toBe(true);
  });
});
