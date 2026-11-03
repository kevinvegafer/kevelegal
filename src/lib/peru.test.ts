import { describe, expect, it } from "vitest";
import {
  calcularVencimiento,
  esDiaHabil,
  esNumeroExpedientePJ,
  feriadosNacionales,
  parseISODate,
  toISODate,
  validarDNI,
  validarRUC,
} from "./peru";

describe("documentos peruanos", () => {
  it("DNI requiere exactamente 8 dígitos", () => {
    expect(validarDNI("12345678")).toBe(true);
    expect(validarDNI("1234567")).toBe(false);
    expect(validarDNI("12345678a")).toBe(false);
  });

  it("RUC valida el dígito verificador de SUNAT", () => {
    expect(validarRUC("20100047218")).toBe(true); // RUC real (BCP)
    expect(validarRUC("20100047219")).toBe(false);
    expect(validarRUC("30100047218")).toBe(false); // prefijo inválido
  });

  it("reconoce el formato de expediente del Poder Judicial", () => {
    expect(esNumeroExpedientePJ("00123-2024-0-1801-JR-CI-01")).toBe(true);
    expect(esNumeroExpedientePJ("123-2024")).toBe(false);
  });
});

describe("feriados y plazos", () => {
  it("incluye Jueves y Viernes Santo 2026 (2 y 3 de abril)", () => {
    const f = feriadosNacionales(2026).map((x) => x.fecha);
    expect(f).toContain("2026-04-02");
    expect(f).toContain("2026-04-03");
    expect(f).toContain("2026-12-09");
  });

  it("sábados, domingos y feriados no son hábiles", () => {
    expect(esDiaHabil(parseISODate("2026-07-28"))).toBe(false);
    expect(esDiaHabil(parseISODate("2026-10-31"))).toBe(false); // sábado
    expect(esDiaHabil(parseISODate("2026-10-30"))).toBe(true);
  });

  it("3 días hábiles desde el viernes 30/10/2026 vencen el miércoles 4/11 (1/11 domingo)", () => {
    expect(toISODate(calcularVencimiento(parseISODate("2026-10-30"), 3))).toBe("2026-11-04");
  });

  it("salta Jueves y Viernes Santo", () => {
    // Notificado miércoles 1/4/2026, 1 día hábil => lunes 6/4/2026
    expect(toISODate(calcularVencimiento(parseISODate("2026-04-01"), 1))).toBe("2026-04-06");
  });
});
