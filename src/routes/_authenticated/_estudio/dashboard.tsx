import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarClock,
  CalendarDays,
  Clock,
  FolderKanban,
  ListChecks,
  MousePointerClick,
  Plus,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import {
  clientesQuery,
  eventosQuery,
  expedientesQuery,
  fasesQuery,
  gastosQuery,
  honorariosQuery,
  nombreCliente,
  plazosQuery,
} from "@/lib/queries";
import { tiempoQuery } from "@/lib/queries-tiempo";
import { hoyLima } from "@/lib/cobranza";
import {
  cumplimientoPlazos,
  proximasSemanas,
  sumarPorMes,
  ultimosDias,
  ultimosMeses,
  variacion,
} from "@/lib/estadisticas";
import {
  ESTADOS_EXPEDIENTE,
  feriadosNacionales,
  formatSoles,
  labelOf,
  MATERIAS,
  parseISODate,
  TIPOS_EVENTO,
} from "@/lib/peru";
import { varianteExpediente } from "@/lib/estados";
import { useEstudio } from "@/hooks/use-estudio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ChartConfig } from "@/components/ui/chart";
import { EmptyState } from "@/components/app/ui";
import { PlazoList } from "@/components/app/PlazoList";
import {
  BarrasApiladas,
  BarrasHorizontales,
  ChartCard,
  Dona,
  KpiCard,
  Medidor,
  Segmento,
  TendenciaChart,
} from "@/components/app/PanelGraficos";
import { ExpedienteForm } from "@/components/forms/ExpedienteForm";
import { ClienteForm } from "@/components/forms/ClienteForm";
import { PlazoForm } from "@/components/forms/AgendaForms";

export const Route = createFileRoute("/_authenticated/_estudio/dashboard")({
  head: () => ({
    meta: [
      { title: "Panel — Kevelegal" },
      { name: "description", content: "Gráficos y estadísticas de plazos, audiencias, expedientes y cobranza de su estudio." },
      { property: "og:title", content: "Panel — Kevelegal" },
      { property: "og:description", content: "Resumen visual del estudio jurídico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    const id = context.estudio.id;
    await Promise.all([
      context.queryClient.ensureQueryData(clientesQuery(id)),
      context.queryClient.ensureQueryData(expedientesQuery(id)),
      context.queryClient.ensureQueryData(plazosQuery(id)),
      context.queryClient.ensureQueryData(eventosQuery(id)),
    ]);
  },
  component: Dashboard,
});

const soles = (n: number) => formatSoles(Math.round(n));
const solesCorto = (n: number) =>
  n >= 1_000_000 ? `S/${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `S/${Math.round(n / 1000)}k` : `S/${Math.round(n)}`;
const horas = (n: number) => `${n.toFixed(1)} h`;

function saludo() {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", hour: "numeric", hour12: false }).format(new Date()),
  );
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

function Dashboard() {
  const { estudioId, estudio, puedeVerFinanzas } = useEstudio();
  const { data: clientes } = useSuspenseQuery(clientesQuery(estudioId));
  const { data: expedientes } = useSuspenseQuery(expedientesQuery(estudioId));
  const { data: plazos } = useSuspenseQuery(plazosQuery(estudioId));
  const { data: eventos } = useSuspenseQuery(eventosQuery(estudioId));
  const { data: honorarios = [] } = useQuery({ ...honorariosQuery(estudioId), enabled: puedeVerFinanzas });
  const { data: gastos = [] } = useQuery({ ...gastosQuery(estudioId), enabled: puedeVerFinanzas });
  const { data: tiempo = [] } = useQuery(tiempoQuery(estudioId));
  const { data: fases = [] } = useQuery(fasesQuery(estudioId));

  const [nuevo, setNuevo] = useState<null | "cliente" | "expediente" | "plazo">(null);
  const [vista, setVista] = useState<"finanzas" | "actividad">(puedeVerFinanzas ? "finanzas" : "actividad");
  const [periodo, setPeriodo] = useState<"3" | "6" | "12">("6");
  const [agrupar, setAgrupar] = useState<"materia" | "estado">("materia");
  const [semanaSel, setSemanaSel] = useState<number | null>(null);

  const hoy = hoyLima();
  const ahora = parseISODate(hoy);
  const mesActual = hoy.slice(0, 7);

  const s = useMemo(() => {
    const en7 = format(new Date(ahora.getTime() + 7 * 86400000), "yyyy-MM-dd");
    const pendientes = plazos.filter((p) => p.estado === "pendiente");
    const vencidos = pendientes.filter((p) => p.fecha_vencimiento < hoy);
    const proximos = pendientes.filter((p) => p.fecha_vencimiento >= hoy && p.fecha_vencimiento <= en7);
    const hoyPlazos = pendientes.filter((p) => p.fecha_vencimiento === hoy);
    const enTramite = expedientes.filter((e) => e.estado === "en_tramite");

    const meses12 = ultimosMeses(12, hoy);
    const meses8 = meses12.slice(-8);
    const pagosPEN = honorarios.flatMap((h) => (h.moneda === "PEN" ? h.pagos : []));
    const honPEN = honorarios.filter((h) => h.moneda === "PEN");

    const facturado = sumarPorMes(honPEN, meses12, (h) => h.fecha, (h) => Number(h.monto_total));
    const cobrado = sumarPorMes(pagosPEN, meses12, (p) => p.fecha, (p) => Number(p.monto));
    const gastado = sumarPorMes(gastos, meses12, (g) => g.fecha, (g) => Number(g.monto));
    const nuevosExp = sumarPorMes(expedientes, meses12, (e) => e.created_at);
    const completados = sumarPorMes(
      plazos.filter((p) => p.completado_at),
      meses12,
      (p) => p.completado_at ?? "",
    );
    const audiencias = sumarPorMes(eventos, meses12, (e) => e.inicio);
    const horasMes = sumarPorMes(tiempo, meses12, (t) => t.fecha, (t) => t.segundos / 3600);
    const nuevosCli = sumarPorMes(clientes, meses12, (c) => c.created_at);

    const tendencia = meses12.map((m, i) => ({
      etiqueta: m.etiqueta,
      facturado: Math.round(facturado[i] ?? 0),
      cobrado: Math.round(cobrado[i] ?? 0),
      gastos: Math.round(gastado[i] ?? 0),
      expedientes: nuevosExp[i] ?? 0,
      completados: completados[i] ?? 0,
      audiencias: audiencias[i] ?? 0,
    }));

    const semanas = proximasSemanas(8, hoy);
    const carga = semanas.map((w) => {
      const enSemana = pendientes.filter((p) => p.fecha_vencimiento >= w.inicio && p.fecha_vencimiento <= w.fin);
      return {
        etiqueta: w.etiqueta,
        alta: enSemana.filter((p) => p.prioridad === "alta").length,
        media: enSemana.filter((p) => p.prioridad !== "alta" && p.prioridad !== "baja").length,
        baja: enSemana.filter((p) => p.prioridad === "baja").length,
      };
    });
    const cargaSerie = carga.map((c) => c.alta + c.media + c.baja);

    const porMateria = new Map<string, number>();
    const porEstado = new Map<string, number>();
    for (const e of expedientes) {
      porMateria.set(e.materia, (porMateria.get(e.materia) ?? 0) + 1);
      porEstado.set(e.estado, (porEstado.get(e.estado) ?? 0) + 1);
    }
    const materias = [...porMateria.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ nombre: labelOf(MATERIAS, k), valor: v }));
    const materiasTop =
      materias.length > 6
        ? [...materias.slice(0, 5), { nombre: "Otras", valor: materias.slice(5).reduce((a, b) => a + b.valor, 0) }]
        : materias;
    const estados = [...porEstado.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ nombre: labelOf(ESTADOS_EXPEDIENTE, k), valor: v }));

    const porFase = fases.map((f) => {
      const enFase = enTramite.filter((e) => e.fase_id === f.id);
      const dias = enFase.length
        ? Math.round(
            enFase.reduce((acc, e) => acc + (Date.now() - new Date(e.fase_desde).getTime()) / 86400000, 0) /
              enFase.length,
          )
        : 0;
      return { nombre: f.nombre, valor: enFase.length, detalle: enFase.length ? `${dias} d prom.` : undefined };
    });
    const sinFase = enTramite.filter((e) => !e.fase_id).length;
    if (fases.length && sinFase) porFase.push({ nombre: "Sin fase", valor: sinFase, detalle: undefined });

    const dias14 = ultimosDias(14, hoy);
    const horasDia = dias14.map((d) => {
      const del = tiempo.filter((t) => t.fecha === d);
      const fact = del.filter((t) => t.facturable).reduce((a, t) => a + t.segundos, 0) / 3600;
      const nofact = del.filter((t) => !t.facturable).reduce((a, t) => a + t.segundos, 0) / 3600;
      return {
        etiqueta: format(parseISODate(d), "d/M"),
        facturable: Math.round(fact * 10) / 10,
        interno: Math.round(nofact * 10) / 10,
      };
    });

    const proxEventos = eventos.filter((e) => new Date(e.inicio).getTime() >= Date.now() - 2 * 3600000).slice(0, 5);
    const feriados = [...feriadosNacionales(ahora.getFullYear()), ...feriadosNacionales(ahora.getFullYear() + 1)]
      .filter((f) => f.fecha >= hoy)
      .slice(0, 3);

    const last = (a: number[]) => a[a.length - 1] ?? 0;
    const prev = (a: number[]) => a[a.length - 2] ?? 0;

    return {
      pendientes,
      vencidos,
      proximos,
      hoyPlazos,
      enTramite,
      tendencia,
      semanas,
      carga,
      cargaSerie,
      materias: materiasTop,
      estados,
      porFase,
      horasDia,
      proxEventos,
      feriados,
      cumplimiento: cumplimientoPlazos(plazos, hoy),
      kpi: {
        nuevosExp: { serie: nuevosExp.slice(-8), mes: last(nuevosExp), delta: variacion(last(nuevosExp), prev(nuevosExp)) },
        cobrado: { serie: cobrado.slice(-8), mes: last(cobrado), delta: variacion(last(cobrado), prev(cobrado)) },
        horas: { serie: horasMes.slice(-8), mes: last(horasMes), delta: variacion(Math.round(last(horasMes)), Math.round(prev(horasMes))) },
        clientes: { serie: nuevosCli.slice(-8), mes: last(nuevosCli), delta: variacion(last(nuevosCli), prev(nuevosCli)) },
      },
      meses8,
    };
  }, [plazos, expedientes, eventos, honorarios, gastos, tiempo, clientes, fases, hoy]);

  const tendenciaData = s.tendencia.slice(-Number(periodo));
  const finanzasConfig: ChartConfig = {
    facturado: { label: "Facturado", color: "var(--chart-2)" },
    cobrado: { label: "Cobrado", color: "var(--chart-1)" },
    gastos: { label: "Gastos", color: "var(--chart-5)" },
  };
  const actividadConfig: ChartConfig = {
    expedientes: { label: "Expedientes nuevos", color: "var(--chart-1)" },
    completados: { label: "Plazos cumplidos", color: "var(--chart-4)" },
    audiencias: { label: "Audiencias y citas", color: "var(--info)" },
  };
  const cargaConfig: ChartConfig = {
    alta: { label: "Alta", color: "var(--destructive)" },
    media: { label: "Media", color: "var(--chart-1)" },
    baja: { label: "Baja", color: "var(--chart-5)" },
  };
  const horasConfig: ChartConfig = {
    facturable: { label: "Facturable", color: "var(--chart-1)" },
    interno: { label: "Interno", color: "var(--chart-5)" },
  };

  const semana = semanaSel != null ? s.semanas[semanaSel] : undefined;
  const plazosSemana = semana
    ? s.pendientes.filter((p) => p.fecha_vencimiento >= semana.inicio && p.fecha_vencimiento <= semana.fin)
    : [];
  const totalHoras14 = s.horasDia.reduce((a, d) => a + d.facturable + d.interno, 0);

  const resumen =
    s.vencidos.length > 0
      ? `Tiene ${s.vencidos.length} ${s.vencidos.length === 1 ? "plazo vencido" : "plazos vencidos"} que requieren atención.`
      : s.hoyPlazos.length > 0
        ? `Hoy vencen ${s.hoyPlazos.length} ${s.hoyPlazos.length === 1 ? "plazo" : "plazos"}. Todo lo demás está al día.`
        : s.proximos.length > 0
          ? `Sin vencidos. ${s.proximos.length} ${s.proximos.length === 1 ? "plazo vence" : "plazos vencen"} esta semana.`
          : "Todo al día: no hay plazos vencidos ni urgentes.";

  return (
    <div className="grid gap-4 sm:gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-card animate-in fade-in duration-500">
        <div aria-hidden className="absolute inset-0 bg-hero" />
        <div aria-hidden className="absolute inset-0 grid-lines opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative grid gap-6 p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3" />
              {format(ahora, "EEEE d 'de' MMMM", { locale: es })}
            </p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl lg:text-5xl">
              {saludo()}, <span className="text-gradient-primary">{estudio.nombre}</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">{resumen}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="hero" onClick={() => setNuevo("expediente")}>
                <Plus /> Expediente
              </Button>
              <Button variant="outline" onClick={() => setNuevo("cliente")}>
                <Plus /> Cliente
              </Button>
              <Button variant="outline" onClick={() => setNuevo("plazo")}>
                <Plus /> Plazo
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 rounded-2xl border border-border bg-background/60 p-4 backdrop-blur md:flex-col md:gap-2">
            <Medidor
              porcentaje={s.cumplimiento.porcentaje}
              label="A tiempo"
              sub={s.cumplimiento.total ? `${s.cumplimiento.aTiempo} de ${s.cumplimiento.total}` : "sin datos"}
            />
            <div className="text-left md:text-center">
              <p className="text-sm font-semibold">Cumplimiento de plazos</p>
              <p className="max-w-[12rem] text-xs text-muted-foreground">Plazos cumplidos antes de su vencimiento</p>
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          icon={FolderKanban}
          label="Expedientes activos"
          value={s.enTramite.length}
          hint={`${s.kpi.nuevosExp.mes} nuevos este mes`}
          delta={s.kpi.nuevosExp.delta}
          deltaLabel="Expedientes nuevos vs. mes anterior"
          serie={s.kpi.nuevosExp.serie}
          to="/expedientes"
          delay={0}
        />
        <KpiCard
          icon={ListChecks}
          label="Vencen en 7 días"
          value={s.proximos.length}
          hint={s.vencidos.length ? `${s.vencidos.length} vencidos` : "Ningún vencido"}
          serie={s.cargaSerie}
          to="/plazos"
          tone={s.vencidos.length ? "danger" : "primary"}
          delay={80}
        />
        {puedeVerFinanzas ? (
          <KpiCard
            icon={Wallet}
            label="Cobrado este mes"
            value={s.kpi.cobrado.mes}
            format={soles}
            delta={s.kpi.cobrado.delta}
            deltaLabel="Vs. mes anterior"
            hint="Pagos en soles"
            serie={s.kpi.cobrado.serie}
            to="/finanzas"
            tone="success"
            delay={160}
          />
        ) : (
          <KpiCard
            icon={Users}
            label="Clientes"
            value={clientes.length}
            hint={`${s.kpi.clientes.mes} nuevos este mes`}
            delta={s.kpi.clientes.delta}
            serie={s.kpi.clientes.serie}
            to="/clientes"
            tone="success"
            delay={160}
          />
        )}
        <KpiCard
          icon={Clock}
          label="Horas este mes"
          value={s.kpi.horas.mes}
          format={horas}
          delta={s.kpi.horas.delta}
          deltaLabel="Vs. mes anterior"
          hint="Tiempo registrado"
          serie={s.kpi.horas.serie}
          to="/tiempo"
          delay={240}
        />
      </div>

      {/* Tendencia + distribución */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          style={{ animationDelay: "120ms" }}
          title={vista === "finanzas" ? "Ingresos y gastos" : "Actividad del estudio"}
          subtitle={
            vista === "finanzas"
              ? "Toque una serie para ocultarla · montos en soles"
              : "Expedientes, plazos cumplidos y audiencias por mes"
          }
          action={
            <div className="flex flex-wrap gap-2">
              {puedeVerFinanzas && (
                <Segmento
                  value={vista}
                  onChange={setVista}
                  options={[
                    { value: "finanzas", label: "Finanzas" },
                    { value: "actividad", label: "Actividad" },
                  ]}
                />
              )}
              <Segmento
                value={periodo}
                onChange={setPeriodo}
                options={[
                  { value: "3", label: "3M" },
                  { value: "6", label: "6M" },
                  { value: "12", label: "12M" },
                ]}
              />
            </div>
          }
        >
          {vista === "finanzas" ? (
            <TendenciaChart
              key={`f-${periodo}`}
              data={tendenciaData}
              config={finanzasConfig}
              series={["facturado", "cobrado", "gastos"]}
              formatoY={solesCorto}
              formatoTooltip={soles}
            />
          ) : (
            <TendenciaChart
              key={`a-${periodo}`}
              data={tendenciaData}
              config={actividadConfig}
              series={["expedientes", "completados", "audiencias"]}
            />
          )}
        </ChartCard>

        <ChartCard
          style={{ animationDelay: "180ms" }}
          title="Expedientes"
          subtitle="Pase el cursor o toque para ver el detalle"
          action={
            <Segmento
              value={agrupar}
              onChange={setAgrupar}
              options={[
                { value: "materia", label: "Materia" },
                { value: "estado", label: "Estado" },
              ]}
            />
          }
        >
          {expedientes.length === 0 ? (
            <SinDatos texto="Cuando registre expedientes verá aquí su distribución." />
          ) : (
            <Dona key={agrupar} data={agrupar === "materia" ? s.materias : s.estados} centro="expedientes" />
          )}
        </ChartCard>
      </div>

      {/* Carga semanal + fases */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          style={{ animationDelay: "220ms" }}
          title="Carga de plazos · próximas 8 semanas"
          subtitle="Toque una semana para ver sus plazos"
          action={
            semana ? (
              <Button size="sm" variant="ghost" onClick={() => setSemanaSel(null)}>
                Quitar selección
              </Button>
            ) : (
              <MousePointerClick className="size-4 text-muted-foreground" />
            )
          }
        >
          <BarrasApiladas
            data={s.carga}
            config={cargaConfig}
            series={["alta", "media", "baja"]}
            seleccion={semanaSel}
            onSeleccion={setSemanaSel}
          />
          {semana && (
            <div className="mt-3 rounded-xl border border-border bg-background/50 p-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Semana del {format(parseISODate(semana.inicio), "d MMM", { locale: es })} al{" "}
                {format(parseISODate(semana.fin), "d MMM", { locale: es })} · {plazosSemana.length}{" "}
                {plazosSemana.length === 1 ? "plazo" : "plazos"}
              </p>
              <PlazoList
                plazos={plazosSemana}
                empty={<p className="py-4 text-center text-sm text-muted-foreground">Semana libre de plazos.</p>}
              />
            </div>
          )}
        </ChartCard>

        <ChartCard
          style={{ animationDelay: "260ms" }}
          title={s.porFase.length ? "Expedientes por fase" : "Expedientes por estado"}
          subtitle={s.porFase.length ? "En trámite · días promedio en la fase" : "Configure fases en el tablero"}
          action={
            <Link to="/tablero" className="text-xs text-primary hover:underline">
              Tablero
            </Link>
          }
        >
          {s.porFase.length ? (
            <BarrasHorizontales data={s.porFase} />
          ) : s.estados.length ? (
            <BarrasHorizontales data={s.estados} />
          ) : (
            <SinDatos texto="Aún no hay expedientes para mostrar." />
          )}
        </ChartCard>
      </div>

      {/* Plazos urgentes + audiencias */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title={
            <span className="inline-flex items-center gap-2">
              Plazos urgentes
              {s.vencidos.length > 0 && <Badge variant="danger">{s.vencidos.length} vencidos</Badge>}
            </span>
          }
          action={
            <Link to="/plazos" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          }
        >
          <div className="px-2 sm:px-1">
            <PlazoList
              plazos={[...s.vencidos, ...s.proximos].slice(0, 8)}
              empty={
                <EmptyState
                  icon={CalendarClock}
                  title="Sin plazos urgentes"
                  description="No hay plazos vencidos ni por vencer en los próximos 7 días."
                />
              }
            />
          </div>
        </ChartCard>

        <ChartCard
          title="Próximas audiencias"
          action={
            <Link to="/calendario" className="text-xs text-primary hover:underline">
              Calendario
            </Link>
          }
        >
          <div className="px-2 sm:px-1">
            {s.proxEventos.length === 0 ? (
              <div className="grid place-items-center gap-2 py-6 text-center">
                <CalendarDays className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No hay eventos agendados.</p>
              </div>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {s.proxEventos.map((e) => {
                  const d = new Date(e.inicio);
                  return (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[1.6rem] top-1 size-3 rounded-full border-2 border-card bg-gradient-primary shadow-glow" />
                      <p className="text-xs font-medium text-primary">
                        {format(d, "EEE d MMM · HH:mm", { locale: es })}
                      </p>
                      <p className="truncate text-sm font-medium">{e.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {labelOf(TIPOS_EVENTO, e.tipo)} · {e.modalidad === "virtual" ? "Virtual" : e.lugar || "Presencial"}
                      </p>
                      {e.expediente && (
                        <Link
                          to="/expedientes/$id"
                          params={{ id: e.expediente.id }}
                          className="block truncate text-xs text-primary hover:underline"
                        >
                          {e.expediente.numero_expediente || e.expediente.titulo}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {s.feriados.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Próximos feriados</p>
                <ul className="space-y-1.5 text-sm">
                  {s.feriados.map((f) => (
                    <li key={f.fecha} className="flex items-center justify-between gap-2">
                      <span className="truncate">{f.nombre}</span>
                      <Badge variant="muted" className="shrink-0">
                        {format(parseISODate(f.fecha), "d MMM", { locale: es })}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Horas + recientes */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <ChartCard
          title="Horas · últimos 14 días"
          subtitle={`${totalHoras14.toFixed(1)} h registradas`}
          action={
            <Link to="/tiempo" className="text-xs text-primary hover:underline">
              Tiempo
            </Link>
          }
        >
          <BarrasApiladas
            data={s.horasDia}
            config={horasConfig}
            series={["facturable", "interno"]}
            height="h-52 sm:h-60"
          />
        </ChartCard>

        <ChartCard
          className="lg:col-span-2"
          title="Expedientes recientes"
          action={
            <Link to="/expedientes" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          }
        >
          <div className="px-2 sm:px-1">
            {expedientes.length === 0 ? (
              <EmptyState
                icon={clientes.length ? FolderKanban : Users}
                title={clientes.length ? "Aún no hay expedientes" : "Empiece registrando un cliente"}
                description={
                  clientes.length
                    ? "Cree el primer expediente y vincúlelo a su cliente."
                    : "Registre a su primer cliente con DNI o RUC y luego abra su expediente."
                }
                action={
                  <Button variant="hero" onClick={() => setNuevo(clientes.length ? "expediente" : "cliente")}>
                    <Plus /> {clientes.length ? "Nuevo expediente" : "Nuevo cliente"}
                  </Button>
                }
              />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {expedientes.slice(0, 6).map((e) => (
                  <li key={e.id}>
                    <Link
                      to="/expedientes/$id"
                      params={{ id: e.id }}
                      className="group flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                        <FolderKanban className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium group-hover:text-primary">{e.titulo}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {nombreCliente(e.cliente)} · {labelOf(MATERIAS, e.materia)}
                        </p>
                      </div>
                      <Badge variant={varianteExpediente(e.estado)} className="shrink-0">
                        {labelOf(ESTADOS_EXPEDIENTE, e.estado)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ChartCard>
      </div>

      {nuevo === "cliente" && <ClienteForm open onOpenChange={(o) => !o && setNuevo(null)} />}
      {nuevo === "expediente" && <ExpedienteForm open onOpenChange={(o) => !o && setNuevo(null)} />}
      {nuevo === "plazo" && <PlazoForm open onOpenChange={(o) => !o && setNuevo(null)} />}
    </div>
  );
}

function SinDatos({ texto }: { texto: string }) {
  return (
    <div className="grid h-full min-h-48 place-items-center px-4 text-center">
      <p className="max-w-xs text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}
