// Reglas puras del modo demostración (avisos, enlaces, reservas). Probadas en demo-reglas.test.ts.
import { estadoCuotas } from "@/lib/cobranza";

type Row = Record<string, unknown>;
export type DB = Record<string, Row[]>;

export type Aviso = { clave: string; tipo: string; titulo: string; detalle: string; enlace: string; fecha: string };

const DIA = 864e5;
const s = (v: unknown) => (v == null ? "" : String(v));

/** Avisos derivados de los datos guardados, sin los descartados. */
export function derivarAvisos(db: DB, estudioId: string, userId: string, ahora: Date): Aviso[] {
  const hoy = ahora.toISOString().slice(0, 10);
  const en2 = new Date(ahora.getTime() + 2 * DIA).toISOString().slice(0, 10);
  const de = (t: string) => (db[t] ?? []).filter((r) => r["estudio_id"] === estudioId);
  const descartadas = new Set((db["avisos_descartados"] ?? []).filter((r) => r["user_id"] === userId).map((r) => s(r["clave"])));
  const exps = new Map(de("expedientes").map((e) => [s(e["id"]), s(e["titulo"])]));
  const out: Aviso[] = [];

  for (const e of de("eventos")) {
    const inicio = Date.parse(s(e["inicio"]));
    if (!(inicio >= ahora.getTime() && inicio <= ahora.getTime() + 2 * DIA)) continue;
    out.push({ clave: `evento:${s(e["id"])}`, tipo: "evento", titulo: `Próximo: ${s(e["titulo"])}`,
      detalle: exps.get(s(e["expediente_id"])) ?? s(e["lugar"]), enlace: "/calendario", fecha: s(e["inicio"]) });
  }
  for (const p of de("plazos")) {
    const f = s(p["fecha_vencimiento"]);
    if (p["estado"] !== "pendiente" || !f || f > en2) continue;
    out.push({ clave: `plazo:${s(p["id"])}:${f}`, tipo: "plazo",
      titulo: f < hoy ? `Plazo vencido: ${s(p["titulo"])}` : f === hoy ? `Vence hoy: ${s(p["titulo"])}` : `Por vencer: ${s(p["titulo"])}`,
      detalle: exps.get(s(p["expediente_id"])) ?? "", enlace: "/plazos", fecha: `${f}T12:00:00.000Z` });
  }
  const pagos = de("pagos");
  for (const h of de("honorarios")) {
    const cuotas = de("cuotas").filter((c) => c["honorario_id"] === h["id"])
      .map((c) => ({ id: s(c["id"]), numero: Number(c["numero"]), monto: Number(c["monto"]), fecha_vencimiento: s(c["fecha_vencimiento"]) }));
    if (!cuotas.length) continue;
    const pagado = pagos.filter((p) => p["honorario_id"] === h["id"]).reduce((a, p) => a + Number(p["monto"] ?? 0), 0);
    for (const c of estadoCuotas(cuotas, pagado, hoy)) {
      if (c.estado !== "vencida") continue;
      out.push({ clave: `cuota:${c.id}`, tipo: "cuota", titulo: `Cuota ${c.numero} vencida: ${s(h["concepto"])}`,
        detalle: `Saldo S/ ${c.saldo.toFixed(2)}`, enlace: "/finanzas", fecha: `${c.fecha_vencimiento}T12:00:00.000Z` });
    }
  }
  for (const m of de("mensajes_cliente")) {
    if (m["autor"] !== "cliente" || m["leido_at"]) continue;
    out.push({ clave: `mensaje:${s(m["id"])}`, tipo: "mensaje", titulo: "Nuevo mensaje del portal",
      detalle: s(m["cuerpo"]).slice(0, 140), enlace: "/mensajes", fecha: s(m["created_at"]) });
  }
  for (const c of de("citas")) {
    if (c["estado"] !== "pendiente") continue;
    out.push({ clave: `cita:${s(c["id"])}`, tipo: "cita", titulo: `Cita solicitada: ${s(c["nombre"])}`,
      detalle: s(c["motivo"]), enlace: "/calendario", fecha: s(c["created_at"]) });
  }
  for (const n of de("notificaciones")) {
    if (n["user_id"] && n["user_id"] !== userId) continue;
    if (n["tipo"] === "mensaje" || n["tipo"] === "cita") continue; // ya cubiertos arriba
    out.push({ clave: `notif:${s(n["id"])}`, tipo: s(n["tipo"]), titulo: s(n["titulo"]),
      detalle: s(n["detalle"]), enlace: s(n["enlace"]) || "/dashboard", fecha: s(n["created_at"]) });
  }
  return out.filter((a) => !descartadas.has(a.clave)).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Un enlace de documento solo abre si existe, no está revocado y no caducó. */
export function estadoEnlace(enlace: Row | undefined, ahora: Date): "ok" | "no_existe" | "revocado" | "caducado" {
  if (!enlace) return "no_existe";
  if (enlace["revocado"]) return "revocado";
  if (Date.parse(s(enlace["expira_at"])) <= ahora.getTime()) return "caducado";
  return "ok";
}

/** true si [inicio, fin) no se cruza con ninguna reserva existente. */
export function horarioLibre(ocupado: readonly { inicio: string; fin: string }[], inicio: string, fin: string) {
  const a = Date.parse(inicio), b = Date.parse(fin);
  if (!(a < b)) return false;
  return ocupado.every((o) => Date.parse(o.fin) <= a || Date.parse(o.inicio) >= b);
}
