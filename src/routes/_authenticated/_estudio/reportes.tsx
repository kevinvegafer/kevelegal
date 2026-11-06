import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { useEstudio } from "@/hooks/use-estudio";
import { leerTabla, csv, descargar } from "@/lib/exportar-datos";
import { miembrosQuery, nombreMiembro, nombreCliente } from "@/lib/queries";
import { estadoCuotas, hoyLima, formatDuracion } from "@/lib/cobranza";
import { formatSoles } from "@/lib/peru";
import { mensajeError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, EmptyState, Field, Panel, Stat } from "@/components/app/ui";
export const Route = createFileRoute("/_authenticated/_estudio/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes del estudio — Kevelegal" },
      {
        name: "description",
        content: "Indicadores de facturación, cobranza, horas y expedientes.",
      },
      { property: "og:title", content: "Reportes del estudio — Kevelegal" },
      { property: "og:description", content: "Analice la actividad y las finanzas de su estudio." },
    ],
  }),
  component: Reportes,
});
function Tabla({ titulo, filas }: { titulo: string; filas: Record<string, string | number>[] }) {
  const columns = Object.keys(filas[0] ?? {});
  const numerica = columns.find((c) => filas.some((f) => typeof f[c] === "number"));
  const max = Math.max(1, ...filas.map((f) => Number(numerica ? f[numerica] : 0) || 0));
  return (
    <Panel
      title={titulo}
      action={
        <Button
          className="print:hidden"
          size="sm"
          variant="outline"
          disabled={!filas.length}
          onClick={() =>
            descargar(new Blob([csv(filas)], { type: "text/csv;charset=utf-8" }), `${titulo}.csv`)
          }
        >
          Exportar CSV
        </Button>
      }
    >
      <div className="overflow-x-auto">
        {!filas.length ? (
          <p>Sin datos para el período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} className="p-2 text-left">
                    {c}
                  </th>
                ))}
                <th aria-label="Gráfico" />
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i} className="border-t border-border">
                  {columns.map((c) => (
                    <td key={c} className="p-2">
                      {f[c]}
                    </td>
                  ))}
                  <td className="w-28">
                    <div className="h-2 bg-accent rounded">
                      <div
                        className="h-2 bg-primary rounded"
                        style={{
                          width: `${(Math.max(0, Number(numerica ? f[numerica] : 0) || 0) / max) * 100}%`,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}
function Reportes() {
  const { estudioId, puedeVerFinanzas } = useEstudio();
  const [desde, setDesde] = useState(hoyLima().slice(0, 4) + "-01-01"),
    [hasta, setHasta] = useState(hoyLima());
  const q = useQuery({
    queryKey: ["tiempo", "reportes", estudioId],
    enabled: puedeVerFinanzas,
    queryFn: async () => {
      const [honorarios, pagos, cuotas, tiempo, gastos, clientes, expedientes] = await Promise.all([
        leerTabla("honorarios", estudioId),
        leerTabla("pagos", estudioId),
        leerTabla("cuotas", estudioId),
        leerTabla("registros_tiempo", estudioId),
        leerTabla("gastos", estudioId),
        leerTabla("clientes", estudioId),
        leerTabla("expedientes", estudioId),
      ]);
      return { honorarios, pagos, cuotas, tiempo, gastos, clientes, expedientes };
    },
  });
  const { data: miembros = [] } = useQuery({
    ...miembrosQuery(estudioId),
    enabled: puedeVerFinanzas,
  });
  if (!puedeVerFinanzas)
    return (
      <EmptyState
        icon={Shield}
        title="Reportes restringidos"
        description="Solo administradores y abogados pueden ver los reportes."
      />
    );
  const d = q.data;
  const rango = (fecha: string) => fecha >= desde && fecha <= hasta;
  const hs = d?.honorarios.filter((h) => rango(h.fecha)) ?? [],
    ps = d?.pagos.filter((p) => rango(p.fecha)) ?? [],
    ts = d?.tiempo.filter((t) => rango(t.fecha)) ?? [];
  const saldo = (h: NonNullable<typeof d>["honorarios"][number]) =>
    Math.max(
      0,
      h.monto_total -
        (d?.pagos
          .filter((p) => p.honorario_id === h.id && p.fecha <= hasta)
          .reduce((s, p) => s + p.monto, 0) ?? 0),
    );
  const vencido = (h: NonNullable<typeof d>["honorarios"][number]) =>
    estadoCuotas(
      d?.cuotas.filter((c) => c.honorario_id === h.id) ?? [],
      d?.pagos
        .filter((p) => p.honorario_id === h.id && p.fecha <= hasta)
        .reduce((s, p) => s + p.monto, 0) ?? 0,
      hasta,
    )
      .filter((c) => c.estado === "vencida")
      .reduce((s, c) => s + c.saldo, 0);
  const tablasClientes = (d?.clientes ?? []).flatMap((c) =>
    ["PEN", "USD"].flatMap((moneda) => {
      const honorarios =
        d?.honorarios.filter(
          (h) => h.cliente_id === c.id && h.moneda === moneda && h.fecha <= hasta,
        ) ?? [];
      return honorarios.length
        ? [
            {
              Cliente: nombreCliente(c),
              Moneda: moneda,
              Saldo: Number(honorarios.reduce((s, h) => s + saldo(h), 0).toFixed(2)),
              Vencido: Number(honorarios.reduce((s, h) => s + vencido(h), 0).toFixed(2)),
            },
          ]
        : [];
    }),
  );
  const meses = Array.from(new Set(ps.map((p) => p.fecha.slice(0, 7))))
    .sort()
    .flatMap((mes) =>
      ["PEN", "USD"].map((moneda) => ({
        Mes: mes,
        Moneda: moneda,
        Cobrado: ps
          .filter(
            (p) =>
              p.fecha.startsWith(mes) &&
              d?.honorarios.some((h) => h.id === p.honorario_id && h.moneda === moneda),
          )
          .reduce((s, p) => s + p.monto, 0),
      })),
    );
  const horas = Array.from(new Set(ts.map((t) => t.user_id))).map((id) => ({
    Miembro: nombreMiembro(miembros, id),
    Horas: Number(
      (ts.filter((t) => t.user_id === id).reduce((s, t) => s + t.segundos, 0) / 3600).toFixed(2),
    ),
    Facturables: Number(
      (
        ts.filter((t) => t.user_id === id && t.facturable).reduce((s, t) => s + t.segundos, 0) /
        3600
      ).toFixed(2),
    ),
    Facturadas: Number(
      (
        ts.filter((t) => t.user_id === id && t.honorario_id).reduce((s, t) => s + t.segundos, 0) /
        3600
      ).toFixed(2),
    ),
  }));
  const casos = d?.expedientes.filter((e) => rango(e.created_at.slice(0, 10))) ?? [];
  const grupos = Array.from(new Set(casos.map((e) => JSON.stringify([e.estado, e.materia])))).map(
    (key) => {
      const items = casos.filter((e) => JSON.stringify([e.estado, e.materia]) === key);
      return {
        Estado: items[0]?.estado ?? "",
        Materia: items[0]?.materia ?? "",
        Expedientes: items.length,
      };
    },
  );
  return (
    <div id="reporte" className="space-y-5">
      <style>{`@media print { body * { visibility:hidden!important; } #reporte, #reporte * { visibility:visible!important; } #reporte { position:absolute;left:0;top:0;width:100%; } [data-sidebar], body>header, #reporte .print\\:hidden { display:none!important; } #reporte section { break-inside:avoid; } }`}</style>
      <PageHeader
        title="Reportes del estudio"
        description="Flujos por fecha; saldos acumulados al cierre. No se mezclan monedas."
        actions={
          <Button className="print:hidden" onClick={() => window.print()}>
            Descargar PDF
          </Button>
        }
      />
      <div className="flex flex-wrap gap-3 print:hidden">
        <Field label="Desde">
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">
        Período: {desde} — {hasta}. Saldos y vencidos: todos los acuerdos hasta {hasta}, con pagos
        hasta esa fecha. Tasa de cobro: pagos del período / honorarios del período (puede superar
        100%). Horas: segundos acumulados guardados, sin el tramo en curso. Expedientes: creados en
        el período, estado actual.
      </p>
      {desde > hasta ? (
        <p role="alert">El inicio debe ser anterior al cierre.</p>
      ) : q.isPending ? (
        <p>Cargando…</p>
      ) : q.isError ? (
        <p role="alert">{mensajeError(q.error)}</p>
      ) : (
        <>
          {["PEN", "USD"].map((moneda) => {
            const facturado = hs
                .filter((h) => h.moneda === moneda)
                .reduce((s, h) => s + h.monto_total, 0),
              cobrado = ps
                .filter((p) =>
                  d?.honorarios.some((h) => h.id === p.honorario_id && h.moneda === moneda),
                )
                .reduce((s, p) => s + p.monto, 0),
              todos = d?.honorarios.filter((h) => h.fecha <= hasta && h.moneda === moneda) ?? [];
            return (
              <div key={moneda}>
                <h2 className="font-display text-lg mb-2">{moneda}</h2>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <Stat label="Facturado" value={formatSoles(facturado, moneda)} />
                  <Stat label="Cobrado" value={formatSoles(cobrado, moneda)} />
                  <Stat
                    label="Tasa de cobro"
                    value={facturado ? `${((cobrado / facturado) * 100).toFixed(1)} %` : "—"}
                  />
                  <Stat
                    label="Saldo pendiente"
                    value={formatSoles(
                      todos.reduce((s, h) => s + saldo(h), 0),
                      moneda,
                    )}
                  />
                  <Stat
                    label="Saldo vencido"
                    value={formatSoles(
                      todos.reduce((s, h) => s + vencido(h), 0),
                      moneda,
                    )}
                  />
                </div>
              </div>
            );
          })}
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat
              label="Horas registradas"
              value={formatDuracion(ts.reduce((s, t) => s + t.segundos, 0))}
            />
            <Stat
              label="Horas facturables"
              value={formatDuracion(
                ts.filter((t) => t.facturable).reduce((s, t) => s + t.segundos, 0),
              )}
            />
            <Stat
              label="Horas facturadas"
              value={formatDuracion(
                ts.filter((t) => t.honorario_id).reduce((s, t) => s + t.segundos, 0),
              )}
            />
            <Stat
              label="Gastos (PEN)"
              value={formatSoles(
                d?.gastos.filter((g) => rango(g.fecha)).reduce((s, g) => s + g.monto, 0) ?? 0,
              )}
            />
          </div>
          <Tabla titulo="Saldos por cliente" filas={tablasClientes} />
          <Tabla titulo="Cobranza por mes" filas={meses} />
          <Tabla titulo="Horas por miembro" filas={horas} />
          <Tabla titulo="Expedientes por estado y materia" filas={grupos} />
        </>
      )}
    </div>
  );
}
