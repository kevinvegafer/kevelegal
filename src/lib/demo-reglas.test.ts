import { describe, expect, it } from "vitest";
import { derivarAvisos, estadoEnlace, horarioLibre } from "./demo-reglas";

const E = "est-1", U = "user-1";
const ahora = new Date("2026-11-06T15:00:00.000Z");

describe("avisos", () => {
  it("avisa de un plazo pendiente vencido y no de uno cumplido", () => {
    const db = { plazos: [
      { id: "p1", estudio_id: E, estado: "pendiente", titulo: "A", fecha_vencimiento: "2026-11-05" },
      { id: "p2", estudio_id: E, estado: "cumplido", titulo: "B", fecha_vencimiento: "2026-11-05" },
    ] };
    const av = derivarAvisos(db, E, U, ahora);
    expect(av.map((a) => a.clave)).toEqual(["plazo:p1:2026-11-05"]);
  });
  it("no avisa de plazos que vencen en más de 2 días", () => {
    const db = { plazos: [{ id: "p1", estudio_id: E, estado: "pendiente", titulo: "A", fecha_vencimiento: "2026-11-10" }] };
    expect(derivarAvisos(db, E, U, ahora)).toHaveLength(0);
  });
  it("oculta los avisos descartados", () => {
    const db = {
      plazos: [{ id: "p1", estudio_id: E, estado: "pendiente", titulo: "A", fecha_vencimiento: "2026-11-06" }],
      avisos_descartados: [{ user_id: U, clave: "plazo:p1:2026-11-06" }],
    };
    expect(derivarAvisos(db, E, U, ahora)).toHaveLength(0);
  });
  it("avisa de una cuota vencida que los pagos no cubren", () => {
    const db = {
      honorarios: [{ id: "h1", estudio_id: E, concepto: "Defensa" }],
      cuotas: [
        { id: "c1", estudio_id: E, honorario_id: "h1", numero: 1, monto: 500, fecha_vencimiento: "2026-10-01" },
        { id: "c2", estudio_id: E, honorario_id: "h1", numero: 2, monto: 500, fecha_vencimiento: "2026-11-01" },
      ],
      pagos: [{ id: "x", estudio_id: E, honorario_id: "h1", monto: 500 }],
    };
    expect(derivarAvisos(db, E, U, ahora).map((a) => a.clave)).toEqual(["cuota:c2"]);
  });
  it("no mezcla avisos de otro estudio", () => {
    const db = { plazos: [{ id: "p1", estudio_id: "otro", estado: "pendiente", titulo: "A", fecha_vencimiento: "2026-11-05" }] };
    expect(derivarAvisos(db, E, U, ahora)).toHaveLength(0);
  });
});

describe("enlaces de documento", () => {
  it("abre un enlace vigente", () => {
    expect(estadoEnlace({ revocado: false, expira_at: "2026-11-07T00:00:00Z" }, ahora)).toBe("ok");
  });
  it("rechaza un enlace caducado", () => {
    expect(estadoEnlace({ revocado: false, expira_at: "2026-11-06T14:59:59Z" }, ahora)).toBe("caducado");
  });
  it("rechaza un enlace revocado aunque siga vigente", () => {
    expect(estadoEnlace({ revocado: true, expira_at: "2026-12-01T00:00:00Z" }, ahora)).toBe("revocado");
  });
});

describe("reserva de citas", () => {
  const ocupado = [{ inicio: "2026-11-10T15:00:00Z", fin: "2026-11-10T15:30:00Z" }];
  it("no permite reservar un horario que se cruza", () => {
    expect(horarioLibre(ocupado, "2026-11-10T15:15:00Z", "2026-11-10T15:45:00Z")).toBe(false);
  });
  it("permite el horario justo después", () => {
    expect(horarioLibre(ocupado, "2026-11-10T15:30:00Z", "2026-11-10T16:00:00Z")).toBe(true);
  });
});
