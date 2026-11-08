import { describe, expect, it } from "vitest";
import { analizarConsulta, buscar, crearIndice, distancia, normalizar, rangosResaltado, type Entrada } from "./busqueda";
import { construirEntradas, type FuentesBusqueda } from "./busqueda-fuentes";

const fuentes: FuentesBusqueda = {
  hoy: "2026-11-08",
  clientes: [
    { id: "c1", tipo_persona: "natural", nombres: "María", apellidos: "Quispe Huamán", tipo_documento: "DNI", numero_documento: "45678912", email: "maria@correo.pe", estado: "activo" },
    { id: "c2", tipo_persona: "juridica", razon_social: "Inversiones Andinas S.A.C.", tipo_documento: "RUC", numero_documento: "20512345678", estado: "activo" },
  ],
  expedientes: [
    { id: "e1", titulo: "Alimentos — Quispe", numero_expediente: "01234-2026-0-1801-JP-FC-01", materia: "familia", estado: "en_tramite", cliente: { id: "c1", tipo_persona: "natural", nombres: "María", apellidos: "Quispe Huamán" } },
    { id: "e2", titulo: "Cobro de soles — Inversiones Andinas", numero_expediente: "04512-2026-0-1801-JR-CI-03", materia: "civil", estado: "concluido", cliente: { id: "c2", tipo_persona: "juridica", razon_social: "Inversiones Andinas S.A.C." } },
  ],
  plazos: [{ id: "p1", titulo: "Absolver traslado de la demanda", estado: "pendiente", fecha_vencimiento: "2026-11-01", expediente_id: "e1" }],
  tareas: [{ id: "t1", titulo: "Llamar a la clienta", fecha: null, columna: "por_hacer", expediente_id: null }],
  eventos: [{ id: "v1", titulo: "Audiencia única", inicio: "2026-11-20T10:00:00", tipo: "audiencia", expediente_id: "e1" }],
  documentos: [{ id: "d1", nombre: "Demanda de alimentos.pdf", expediente_id: "e1" }],
  partes: [{ id: "x1", nombre: "Juan Pérez Rojas", rol: "Demandado", numero_documento: "40001234", expediente_id: "e1" }],
  paginas: [{ to: "/calendario", label: "Calendario", claves: "agenda audiencias" }],
};
const indice = crearIndice(construirEntradas(fuentes));
const claves = (q: string, tipos?: Parameters<typeof buscar>[2]) =>
  buscar(indice, q, tipos).grupos.flatMap((g) => g.items.map((i) => i.clave));

describe("normalizar", () => {
  it("quita tildes, mayúsculas y signos", () => {
    expect(normalizar("  Huamán, S.A.C. — Ñuñoa ")).toBe("huaman s a c nunoa");
  });
});

describe("buscar", () => {
  it("ignora tildes: 'huaman' encuentra a María Quispe Huamán", () => {
    expect(claves("huaman")).toContain("cliente:c1");
  });

  it("exige todas las palabras", () => {
    expect(claves("maria quispe")).toContain("cliente:c1");
    expect(claves("maria andinas")).not.toContain("cliente:c1");
  });

  it("encuentra el número de expediente aunque se escriba sin guiones o en partes", () => {
    expect(claves("012342026")[0]).toBe("expediente:e1");
    expect(claves("01234 2026")[0]).toBe("expediente:e1");
  });

  it("encuentra un RUC escrito con espacios", () => {
    expect(claves("205 1234 5678")).toContain("cliente:c2");
  });

  it("busca en plazos, eventos, documentos y partes", () => {
    expect(claves("traslado")).toContain("plazo:p1");
    expect(claves("audiencia unica")).toContain("evento:v1");
    expect(claves("demanda alimentos pdf")).toContain("documento:d1");
    expect(claves("40001234")).toContain("parte:x1");
  });

  it("filtra por prefijo de tipo", () => {
    const r = buscar(indice, "cli:quispe");
    expect(r.grupos.map((g) => g.tipo)).toEqual(["cliente"]);
  });

  it("filtra por los tipos elegidos", () => {
    const r = buscar(indice, "quispe", { tipos: ["expediente"] });
    expect(r.grupos.map((g) => g.tipo)).toEqual(["expediente"]);
  });

  it("excluye con -palabra", () => {
    expect(claves("quispe -alimentos")).not.toContain("expediente:e1");
    expect(claves("quispe -alimentos")).toContain("cliente:c1");
  });

  it("frase exacta entre comillas", () => {
    expect(claves('"cobro de soles"')).toEqual(["expediente:e2"]);
    expect(claves('"soles de cobro"')).toEqual([]);
  });

  it("tolera un error de tipeo solo cuando no hay coincidencia exacta", () => {
    const r = buscar(indice, "quipse");
    expect(r.conErrores).toBe(true);
    expect(r.grupos.flatMap((g) => g.items.map((i) => i.clave))).toContain("cliente:c1");
    expect(buscar(indice, "quispe").conErrores).toBe(false);
  });

  it("respeta el límite por tipo pero informa el total", () => {
    const muchas: Entrada[] = Array.from({ length: 30 }, (_, i) => ({
      clave: `cliente:${i}`, tipo: "cliente", titulo: `Cliente Pérez ${i}`, campos: [{ texto: `Cliente Pérez ${i}`, peso: 1 }],
      destino: { ruta: "/clientes/$id", id: String(i) },
    }));
    const r = buscar(crearIndice(muchas), "perez", { limitePorTipo: 5 });
    expect(r.grupos[0]!.items).toHaveLength(5);
    expect(r.grupos[0]!.total).toBe(30);
  });

  it("es rápido con 50 000 registros", () => {
    const grandes: Entrada[] = Array.from({ length: 50_000 }, (_, i) => ({
      clave: `expediente:${i}`, tipo: "expediente", titulo: `Expediente ${i} cobro de soles`,
      campos: [{ texto: `Expediente ${i} cobro de soles`, peso: 3 }, { texto: `${String(i).padStart(5, "0")}-2026-0-1801-JR-CI-03`, peso: 3 }],
      destino: { ruta: "/expedientes/$id", id: String(i) },
    }));
    const ix = crearIndice(grandes);
    buscar(ix, "cobro");
    const t0 = performance.now();
    const r = buscar(ix, "cobro 2026");
    expect(r.grupos[0]!.total).toBe(50_000);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe("analizarConsulta", () => {
  it("separa frases, exclusiones y tipo", () => {
    expect(analizarConsulta('exp:quispe "acta de conciliacion" -archivado')).toEqual({
      terminos: ["quispe", "acta de conciliacion"],
      excluir: ["archivado"],
      tipo: "expediente",
      vacia: false,
    });
  });
});

describe("distancia", () => {
  it("cuenta cambios entre palabras", () => {
    expect(distancia("quispe", "quipse", 2)).toBe(1);
    expect(distancia("quispe", "garcia", 2)).toBe(3);
    expect(distancia("andinas", "andina", 1)).toBe(1);
  });
});

describe("rangosResaltado", () => {
  it("marca la parte original aunque tenga tildes", () => {
    expect(rangosResaltado("María Huamán", ["huaman"])).toEqual([[6, 12]]);
  });
});
