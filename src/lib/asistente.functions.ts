import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// El navegador envía el contenido de los documentos (modo demostración: los archivos viven allí).
const MAX_TOTAL = 12 * 1024 * 1024;
const docSchema = z.object({
  documentoId: z.string().min(1).max(100),
  nombre: z.string().min(1).max(250),
  mime: z.string().max(150),
  texto: z.string().max(400_000).nullable(),
  base64: z.string().max(MAX_TOTAL).nullable(),
});
const schema = z.object({
  documentos: z.array(docSchema).min(1).max(8),
  pregunta: z.string().trim().max(4000),
  modo: z.enum(["resumen", "pregunta"]),
}).refine((v) => v.modo === "resumen" || v.pregunta.length > 0, { message: "Escriba una pregunta.", path: ["pregunta"] })
  .refine((v) => v.documentos.reduce((a, d) => a + (d.base64?.length ?? 0) + (d.texto?.length ?? 0), 0) <= MAX_TOTAL,
    { message: "Los documentos elegidos son demasiado grandes. Elija menos o más pequeños." });

type Fuente = { n: number; documentoId: string; nombre: string };
type Resultado = { respuesta: string; fuentes: Fuente[] } | { error: string };

const INSTRUCCIONES = `Eres el asistente jurídico de Kevelegal para estudios de abogados en el Perú.
Responde en español claro y profesional, usando solo la información de los documentos entregados.
Cita cada afirmación con el número del documento entre corchetes, por ejemplo [1] o [2].
Si los documentos no contienen la respuesta, dilo con claridad y no inventes datos.
No das asesoría definitiva: recuerda revisar el expediente cuando algo sea dudoso.`;

export const consultarDocumentos = createServerFn({ method: "POST" })
  .inputValidator(schema)
  .handler(async ({ data }): Promise<Resultado> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "El asistente IA no está configurado." };
    const { responderConIA, mensajeErrorIA } = await import("@/lib/ai-gateway.server");
    const fuentes = data.documentos.map((d, i) => ({ n: i + 1, documentoId: d.documentoId, nombre: d.nombre }));
    const partes: Array<
      | { type: "text"; text: string }
      | { type: "file"; data: string; mediaType: string; filename: string }
      | { type: "image"; image: string; mediaType: string }
    > = [];
    data.documentos.forEach((d, i) => {
      const n = i + 1;
      if (d.texto != null) partes.push({ type: "text", text: `Documento [${n}] «${d.nombre}»:\n${d.texto}` });
      else if (d.base64 && d.mime.startsWith("image/")) {
        partes.push({ type: "text", text: `Documento [${n}] «${d.nombre}» (imagen):` });
        partes.push({ type: "image", image: d.base64, mediaType: d.mime });
      } else if (d.base64) {
        partes.push({ type: "text", text: `Documento [${n}] «${d.nombre}»:` });
        partes.push({ type: "file", data: d.base64, mediaType: d.mime || "application/pdf", filename: d.nombre });
      } else partes.push({ type: "text", text: `Documento [${n}] «${d.nombre}»: (formato no legible)` });
    });
    partes.push({
      type: "text",
      text: data.modo === "resumen"
        ? "Resume cada documento: partes, pretensión u objeto, hechos clave, fechas y plazos relevantes, y riesgos. Cita con [n]."
        : `Pregunta: ${data.pregunta}`,
    });
    try {
      const respuesta = await responderConIA(apiKey, INSTRUCCIONES, [{ role: "user", content: partes }]);
      if (!respuesta.trim()) return { error: "El asistente no devolvió una respuesta para estos documentos." };
      return { respuesta, fuentes };
    } catch (e) {
      console.error("asistente IA", e);
      return { error: mensajeErrorIA(e) };
    }
  });
