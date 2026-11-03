import { describe, expect, it } from "vitest";
import { cumplimientoPlazos, lunesDe, proximasSemanas, sumarPorMes, ultimosMeses, variacion } from "./estadisticas";

describe("estadísticas del panel", () => {
  it("lista los últimos meses cruzando el cambio de año", () => {
    expect(ultimosMeses(3, "2026-01-15").map((m) => m.clave)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });

  it("suma montos en el mes correcto e ignora meses fuera del rango", () => {
    const meses = ultimosMeses(2, "2026-11-03");
    const r = sumarPorMes(
      [
        { fecha: "2026-10-31", monto: 100 },
        { fecha: "2026-11-01", monto: 50 },
        { fecha: "2026-11-20", monto: 25 },
        { fecha: "2026-08-01", monto: 999 },
      ],
      meses,
      (x) => x.fecha,
      (x) => x.monto,
    );
    expect(r).toEqual([100, 75]);
  });

  it("las semanas empiezan en lunes", () => {
    expect(lunesDe("2026-11-08")).toBe("2026-11-02"); // domingo → lunes anterior
    expect(proximasSemanas(2, "2026-11-03").map((s) => [s.inicio, s.fin])).toEqual([
      ["2026-11-02", "2026-11-08"],
      ["2026-11-09", "2026-11-15"],
    ]);
  });

  it("calcula la variación contra el periodo anterior", () => {
    expect(variacion(150, 100)).toBe(50);
    expect(variacion(0, 0)).toBe(0);
    expect(variacion(10, 0)).toBeNull();
  });

  it("cumplimiento cuenta completados tarde y pendientes vencidos como no cumplidos", () => {
    const r = cumplimientoPlazos(
      [
        { estado: "completado", fecha_vencimiento: "2026-11-02", completado_at: "2026-11-01T10:00:00Z" },
        { estado: "completado", fecha_vencimiento: "2026-11-02", completado_at: "2026-11-04T10:00:00Z" },
        { estado: "pendiente", fecha_vencimiento: "2026-11-01", completado_at: null },
        { estado: "pendiente", fecha_vencimiento: "2026-12-01", completado_at: null },
      ],
      "2026-11-03",
    );
    expect(r).toEqual({ porcentaje: 33, aTiempo: 1, total: 3 });
  });
});
