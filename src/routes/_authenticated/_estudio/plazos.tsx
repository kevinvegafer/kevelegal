import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calculator, CalendarClock, Columns3, FolderKanban, History, ListChecks, Plus, Scale, Target } from "lucide-react";
import { hoyLima } from "@/lib/cobranza";
import { grupoDe, type Grupo, type Tarea } from "@/lib/mis-tareas";
import { cn } from "@/lib/utils";
import {
  carrilesPorEstado,
  carrilesPorProyecto,
  Historial,
  Tablero,
  TareaDialog,
  useMisTareas,
  VistaEnfoque,
  type FiltroVisibilidad,
} from "@/components/app/MisTareas";
import { miembrosQuery, plazosQuery } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import { calcularVencimiento, feriadosNacionales, parseISODate, toISODate } from "@/lib/peru";
import { useEstudio } from "@/hooks/use-estudio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Field, NativeSelect, PageHeader, Panel } from "@/components/app/ui";
import { PlazoList, type PlazoConExp } from "@/components/app/PlazoList";
import { PlazoForm } from "@/components/forms/AgendaForms";

export const Route = createFileRoute("/_authenticated/_estudio/plazos")({
  head: () => ({
    meta: [
      { title: "Plazos y tareas — Kevelegal" },
      { name: "description", content: "Control de plazos procesales en días hábiles y tareas del estudio." },
      { property: "og:title", content: "Plazos y tareas — Kevelegal" },
      { property: "og:description", content: "Plazos procesales y tareas del abogado en un solo lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(plazosQuery(context.estudio.id)),
  component: PlazosPage,
});

type Vista = "enfoque" | "tablero" | "proyectos" | "plazos" | "historial";

function sumar(hoy: string, n: number) {
  const d = new Date(hoy + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fechaPara(g: Grupo, hoy: string): string | null {
  if (g === "hoy") return hoy;
  if (g === "manana") return sumar(hoy, 1);
  if (g === "semana") return sumar(hoy, 2);
  if (g === "planificadas") return sumar(hoy, 7);
  return null;
}

const VISTAS = [
  { v: "enfoque" as const, label: "Enfoque", icon: Target },
  { v: "tablero" as const, label: "Tablero", icon: Columns3 },
  { v: "proyectos" as const, label: "Por expediente", icon: FolderKanban },
  { v: "plazos" as const, label: "Plazos legales", icon: Scale },
  { v: "historial" as const, label: "Historial", icon: History },
];

function PlazosPage() {
  const { tareas, misPlazos, plazosCumplidos, expedientes, userId } = useMisTareas();
  const [vista, setVista] = useState<Vista>("enfoque");
  const [filtro, setFiltro] = useState<FiltroVisibilidad>("todas");
  const [hechas, setHechas] = useState(false);
  const [abierta, setAbierta] = useState<Tarea | null>(null);
  const [nueva, setNueva] = useState<Partial<Tarea> | null>(null);
  const [nuevoPlazo, setNuevoPlazo] = useState(false);
  const hoy = hoyLima();

  const visibles = tareas.filter((t) =>
    filtro === "todas" ? true : filtro === "privada" ? t.visibilidad === "privada" && t.created_by === userId : t.visibilidad === "estudio",
  );
  const proyecto = (id: string | null) => (id ? expedientes.find((e) => e.id === id)?.titulo : undefined);

  const pendientes = visibles.filter((t) => t.columna !== "hecho");
  const contar = (g: Grupo) =>
    pendientes.filter((t) => grupoDe(t.fecha, hoy) === g).length + misPlazos.filter((p) => grupoDe(p.fecha_vencimiento, hoy) === g).length;
  const inicioSemana = sumar(hoy, -6);
  const hechasSemana =
    visibles.filter((t) => t.columna === "hecho" && (t.completada_at ?? "").slice(0, 10) >= inicioSemana).length +
    plazosCumplidos.filter((p) => (p.completado_at ?? "").slice(0, 10) >= inicioSemana).length;
  const stats = [
    { label: "Vencidas", valor: contar("vencidas"), tono: "danger" },
    { label: "Hoy", valor: contar("hoy"), tono: "primary" },
    { label: "Mañana", valor: contar("manana"), tono: "" },
    { label: "Esta semana", valor: contar("semana"), tono: "" },
    { label: "Completadas (7 días)", valor: hechasSemana, tono: "success" },
  ];

  return (
    <>
      <PageHeader
        title="Plazos y tareas"
        description="Todo su trabajo en un solo lugar: plazos legales, tareas privadas y tareas del estudio."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setNuevoPlazo(true)}>
              <CalendarClock /> Nuevo plazo legal
            </Button>
            <Button variant="hero" onClick={() => setNueva({ fecha: hoy })}>
              <Plus /> Nueva tarea
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(
              "rounded-xl border border-border bg-card px-4 py-3 shadow-card",
              s.tono === "danger" && s.valor > 0 && "border-destructive/40 bg-destructive/5",
              s.tono === "primary" && "border-primary/40 bg-primary/5",
              s.tono === "success" && "border-success/30 bg-success/5",
            )}
          >
            <p
              className={cn(
                "font-display text-3xl",
                s.tono === "danger" && s.valor > 0 && "text-destructive",
                s.tono === "primary" && "text-primary",
                s.tono === "success" && "text-success",
              )}
            >
              {s.valor}
            </p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div role="tablist" className="scroll-row -mx-4 flex max-w-[100vw] gap-1 px-4 sm:mx-0 sm:inline-flex sm:max-w-full sm:flex-wrap sm:rounded-lg sm:border sm:border-border sm:bg-card sm:p-1">
          {VISTAS.map(({ v, label, icon: Icon }) => (
            <button
              key={v}
              role="tab"
              aria-selected={vista === v}
              onClick={() => setVista(v)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors max-sm:rounded-full max-sm:border max-sm:border-border max-sm:bg-card max-sm:py-2",
                vista === v ? "bg-primary text-primary-foreground max-sm:border-primary max-sm:bg-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        {vista !== "plazos" && (
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            {([["todas", "Todas"], ["privada", "Solo mías"], ["estudio", "Del estudio"]] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFiltro(v)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  filtro === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        )}
        {vista === "enfoque" && (
          <label className="ml-auto inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={hechas} onChange={(e) => setHechas(e.target.checked)} className="accent-primary" />
            Mostrar completadas
          </label>
        )}
      </div>

      {vista === "enfoque" && (
        <VistaEnfoque
          tareas={visibles}
          plazos={filtro === "privada" ? [] : misPlazos}
          nombreProyecto={proyecto}
          onOpen={setAbierta}
          onNueva={(g) => setNueva({ fecha: fechaPara(g, hoy) })}
          mostrarHechas={hechas}
        />
      )}
      {vista === "tablero" && (
        <Tablero tareas={visibles} carriles={carrilesPorEstado} nombreProyecto={proyecto} onOpen={setAbierta} onNueva={setNueva} />
      )}
      {vista === "proyectos" && (
        <Tablero tareas={visibles} carriles={carrilesPorProyecto(expedientes, visibles)} nombreProyecto={() => undefined} onOpen={setAbierta} onNueva={setNueva} />
      )}
      {vista === "plazos" && <PlazosLegales />}
      {vista === "historial" && (
        <Historial tareas={visibles} plazosCumplidos={filtro === "privada" ? [] : plazosCumplidos} nombreProyecto={proyecto} onOpen={setAbierta} />
      )}

      {nueva && <TareaDialog open inicial={nueva} onOpenChange={(o) => !o && setNueva(null)} />}
      {abierta && <TareaDialog open tarea={abierta} onOpenChange={(o) => !o && setAbierta(null)} />}
      {nuevoPlazo && <PlazoForm open onOpenChange={setNuevoPlazo} />}
    </>
  );
}

function PlazosLegales() {
  const { estudioId, user, puedeEliminar } = useEstudio();
  const { data: plazos } = useSuspenseQuery(plazosQuery(estudioId));
  const [vista, setVista] = useState<"pendiente" | "completado">("pendiente");
  const [tipo, setTipo] = useState("");
  const [asignado, setAsignado] = useState("");
  const { data: miembros = [] } = useQuery(miembrosQuery(estudioId));
  const [edit, setEdit] = useState<PlazoConExp | null>(null);

  const lista = plazos
    .filter((p) => p.estado === vista && (!tipo || p.tipo === tipo) && (!asignado || (asignado === "_sin" ? !p.asignado_a : p.asignado_a === asignado)))
    .sort((a, b) =>
      vista === "pendiente"
        ? a.fecha_vencimiento.localeCompare(b.fecha_vencimiento)
        : b.fecha_vencimiento.localeCompare(a.fecha_vencimiento),
    );

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={
            <div className="flex gap-1">
              {(["pendiente", "completado"] as const).map((v) => (
                <Button key={v} size="sm" variant={vista === v ? "subtle" : "ghost"} onClick={() => setVista(v)}>
                  {v === "pendiente" ? "Pendientes" : "Completados"}
                </Button>
              ))}
            </div>
          }
          action={
            <div className="flex gap-2">
              <NativeSelect value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-8 w-auto text-xs">
                <option value="">Todos</option>
                <option value="plazo_procesal">Plazos procesales</option>
                <option value="tarea">Tareas</option>
              </NativeSelect>
              <NativeSelect value={asignado} onChange={(e) => setAsignado(e.target.value)} className="h-8 w-auto text-xs" aria-label="Asignado a">
                <option value="">Todo el equipo</option>
                <option value={user.id}>Míos</option>
                {miembros
                  .filter((m) => m.user_id !== user.id)
                  .map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.perfil?.nombre_completo || m.perfil?.email}
                    </option>
                  ))}
                <option value="_sin">Sin asignar</option>
              </NativeSelect>
            </div>
          }
        >
          <PlazoList
            plazos={lista}
            onEdit={setEdit}
            puedeEliminar={puedeEliminar}
            empty={
              <EmptyState
                icon={ListChecks}
                title={vista === "pendiente" ? "Nada pendiente" : "Sin completados"}
                description={vista === "pendiente" ? "Registre plazos procesales y Kevelegal calculará su vencimiento." : undefined}
              />
            }
          />
        </Panel>
        <div className="grid content-start gap-6">
          <Calculadora />
          <Feriados />
        </div>
      </div>

      {edit && <PlazoForm open plazo={edit} onOpenChange={(o) => !o && setEdit(null)} />}
    </>
  );
}

function Calculadora() {
  const [notif, setNotif] = useState(toISODate(new Date()));
  const [dias, setDias] = useState("3");
  const r = useMemo(() => {
    if (!notif || !(Number(dias) > 0)) return null;
    return calcularVencimiento(parseISODate(notif), Number(dias));
  }, [notif, dias]);
  return (
    <Panel title={<span className="flex items-center gap-2"><Calculator className="size-4 text-primary" /> Calculadora de plazos</span>}>
      <div className="grid gap-3">
        <Field label="Notificado el" htmlFor="c-notif">
          <Input id="c-notif" type="date" value={notif} onChange={(e) => setNotif(e.target.value)} />
        </Field>
        <Field label="Días hábiles" htmlFor="c-dias">
          <Input id="c-dias" type="number" min={1} value={dias} onChange={(e) => setDias(e.target.value)} />
        </Field>
        {r && (
          <div className="rounded-lg bg-accent p-3">
            <p className="text-xs text-accent-foreground">Vence el</p>
            <p className="font-display text-xl text-primary first-letter:uppercase">
              {format(r, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Excluye sábados, domingos y feriados nacionales. No considera días inhábiles locales ni
          suspensiones de labores del Poder Judicial.
        </p>
      </div>
    </Panel>
  );
}

function Feriados() {
  const year = new Date().getFullYear();
  const [anio, setAnio] = useState(year);
  const hoy = toISODate(new Date());
  return (
    <Panel
      title="Feriados nacionales"
      action={
        <NativeSelect value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="h-8 w-auto text-xs">
          {[year, year + 1].map((y) => (
            <option key={y}>{y}</option>
          ))}
        </NativeSelect>
      }
    >
      <ul className="space-y-1.5 text-sm">
        {feriadosNacionales(anio).map((f) => (
          <li key={f.fecha} className={f.fecha < hoy ? "flex justify-between gap-2 text-muted-foreground/60" : "flex justify-between gap-2"}>
            <span className="truncate">{f.nombre}</span>
            <span className="shrink-0 text-muted-foreground">{format(parseISODate(f.fecha), "EEE d MMM", { locale: es })}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
