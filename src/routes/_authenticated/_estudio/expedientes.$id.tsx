import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  FileText,
  ListChecks,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
  UsersRound,
  Video,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/demo-db/client";
import {
  actuacionesQuery,
  documentosQuery,
  eventosQuery,
  expedienteQuery,
  gastosQuery,
  honorariosQuery,
  miembrosQuery,
  nombreCliente,
  nombreMiembro,
  partesQuery,
  plantillasQuery,
  plazosQuery,
  type Parte,
} from "@/lib/queries";
import {
  CATEGORIAS_GASTO,
  ESTADOS_EXPEDIENTE,
  MATERIAS,
  TIPOS_EVENTO,
  VIAS,
  formatSoles,
  labelOf,
  parseISODate,
} from "@/lib/peru";
import { varianteExpediente } from "@/lib/estados";
import { mensajeError } from "@/lib/errors";
import { useEstudio } from "@/hooks/use-estudio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TareasExpediente } from "@/components/app/MisTareas";
import { EmptyState, Panel } from "@/components/app/ui";
import { PlazoList, type PlazoConExp } from "@/components/app/PlazoList";
import { ExpedienteForm } from "@/components/forms/ExpedienteForm";
import { EventoForm, PlazoForm } from "@/components/forms/AgendaForms";
import { GastoForm, HonorarioForm } from "@/components/forms/FinanzasForms";
import { ActuacionForm, ParteForm } from "@/components/forms/ExpedienteDetalleForms";
import { DocumentosExpediente } from "@/components/app/Documentos";
import { ultimasVersiones } from "@/lib/documentos.queries";
import { IniciarCronometro } from "@/components/app/Cronometros";
import { AplicarPlantilla } from "@/components/forms/PlantillaForms";
import { CamposExtraExpediente } from "@/components/app/CamposPersonalizados";

const TABS_EXPEDIENTE = ["plazos", "tareas", "audiencias", "partes", "bitacora", "documentos", "economico"] as const;
type TabExpediente = (typeof TABS_EXPEDIENTE)[number];

export const Route = createFileRoute("/_authenticated/_estudio/expedientes/$id")({
  validateSearch: (search: Record<string, unknown>): { tab?: TabExpediente } => {
    const tab = TABS_EXPEDIENTE.find((t) => t === search["tab"]);
    return tab ? { tab } : {};
  },
  head: () => ({
    meta: [
      { title: "Expediente — Kevelegal" },
      { name: "description", content: "Detalle del expediente: partes, bitácora, plazos, audiencias y documentos." },
      { property: "og:title", content: "Expediente — Kevelegal" },
      { property: "og:description", content: "Detalle de expediente en Kevelegal." },
    ],
  }),
  loader: async ({ context, params }) => {
    const e = await context.queryClient.ensureQueryData(expedienteQuery(params.id));
    if (!e) throw notFound();
  },
  component: ExpedienteDetalle,
});

type Modal =
  | null
  | "editar"
  | "parte"
  | "actuacion"
  | "plazo"
  | "evento"
  | "gasto"
  | "honorario"
  | "plantilla";

function ExpedienteDetalle() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const { estudioId, puedeEliminar, puedeVerFinanzas } = useEstudio();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: exp } = useSuspenseQuery(expedienteQuery(id));
  const { data: partes = [] } = useQuery(partesQuery(id));
  const { data: actuaciones = [] } = useQuery(actuacionesQuery(id));
  const { data: documentos = [] } = useQuery(documentosQuery(id));
  const { data: plazos = [] } = useQuery(plazosQuery(estudioId));
  const { data: eventos = [] } = useQuery(eventosQuery(estudioId));
  const { data: gastos = [] } = useQuery(gastosQuery(estudioId));
  const { data: honorarios = [] } = useQuery({ ...honorariosQuery(estudioId), enabled: puedeVerFinanzas });
  const { data: miembros = [] } = useQuery(miembrosQuery(estudioId));
  const { data: plantillas = [] } = useQuery(plantillasQuery(estudioId));
  const [modal, setModal] = useState<Modal>(null);
  const [editPlazo, setEditPlazo] = useState<PlazoConExp | null>(null);
  const [editParte, setEditParte] = useState<Parte | null>(null);

  const delExp = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expedientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expedientes"] });
      toast.success("Expediente eliminado");
      navigate({ to: "/expedientes" });
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  const delRow = useMutation({
    mutationFn: async ({ table, rowId }: { table: "partes_procesales" | "actuaciones" | "eventos" | "gastos"; rowId: string }) => {
      const { error } = await supabase.from(table).delete().eq("id", rowId);
      if (error) throw error;
      return table;
    },
    onSuccess: (table) => {
      const key = { partes_procesales: ["partes", id], actuaciones: ["actuaciones", id], eventos: ["eventos"], gastos: ["gastos"] }[table];
      qc.invalidateQueries({ queryKey: key });
      toast.success("Eliminado");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  if (!exp) return null;
  const misPlazos = plazos.filter((p) => p.expediente_id === id);
  const misEventos = eventos.filter((e) => e.expediente_id === id);
  const misGastos = gastos.filter((g) => g.expediente_id === id);
  const misHonorarios = honorarios.filter((h) => h.expediente_id === id);
  const pendientes = misPlazos.filter((p) => p.estado === "pendiente");

  return (
    <>
      <Link to="/expedientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> Expedientes
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={varianteExpediente(exp.estado)}>{labelOf(ESTADOS_EXPEDIENTE, exp.estado)}</Badge>
            <Badge variant="outline">{labelOf(MATERIAS, exp.materia)}</Badge>
            <Badge variant="outline">Vía {labelOf(VIAS, exp.via).toLowerCase()}</Badge>
          </div>
          <h1 className="mt-3 text-3xl font-semibold">{exp.titulo}</h1>
          <p className="mt-1 font-mono text-sm text-primary">{exp.numero_expediente || "Sin número de expediente"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <IniciarCronometro expedienteId={id} descripcion={exp.titulo} />
          <Button variant="outline" onClick={() => setModal("editar")}>
            <Pencil /> Editar
          </Button>
          {puedeEliminar && (
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm("¿Eliminar el expediente con todas sus partes, plazos, audiencias y documentos?")) delExp.mutate();
              }}
            >
              <Trash2 /> Eliminar
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-px overflow-hidden rounded-xl border border-border bg-border text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Dato label="Cliente">
          {exp.cliente ? (
            <Link to="/clientes/$id" params={{ id: exp.cliente.id }} className="text-primary hover:underline">
              {nombreCliente(exp.cliente)}
            </Link>
          ) : (
            "—"
          )}
        </Dato>
        <Dato label="Órgano jurisdiccional">
          {exp.organo_jurisdiccional || "—"}
          {exp.distrito_judicial && <span className="block text-xs text-muted-foreground">CSJ {exp.distrito_judicial}</span>}
        </Dato>
        <Dato label="Juez / especialista">
          {exp.juez || "—"}
          {exp.especialista && <span className="block text-xs text-muted-foreground">{exp.especialista}</span>}
        </Dato>
        <Dato label="Responsable">{nombreMiembro(miembros, exp.responsable_id)}</Dato>
        <Dato label="Tipo de proceso">{exp.tipo_proceso || "—"}</Dato>
        <Dato label="Etapa">{exp.etapa || "—"}</Dato>
        <Dato label="Cuantía">{exp.cuantia != null ? formatSoles(exp.cuantia) : "—"}</Dato>
        <Dato label="Inicio">
          {exp.fecha_inicio ? format(parseISODate(exp.fecha_inicio), "d MMM yyyy", { locale: es }) : "—"}
        </Dato>
      </div>

      {exp.descripcion && <p className="mb-6 whitespace-pre-wrap text-sm text-muted-foreground">{exp.descripcion}</p>}

      <CamposExtraExpediente expediente={exp} />

      <Tabs key={tab ?? "plazos"} defaultValue={tab ?? "plazos"}>
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          <TabsTrigger value="plazos">Plazos ({pendientes.length})</TabsTrigger>
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
          <TabsTrigger value="audiencias">Audiencias ({misEventos.length})</TabsTrigger>
          <TabsTrigger value="partes">Partes ({partes.length})</TabsTrigger>
          <TabsTrigger value="bitacora">Bitácora ({actuaciones.length})</TabsTrigger>
          <TabsTrigger value="documentos">Documentos ({ultimasVersiones(documentos).length})</TabsTrigger>
          <TabsTrigger value="economico">Económico</TabsTrigger>
        </TabsList>

        <TabsContent value="plazos">
          <Panel
            title="Plazos y tareas"
            action={
              <div className="flex gap-2">
                {plantillas.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setModal("plantilla")}>
                    <Workflow /> Aplicar plantilla
                  </Button>
                )}
                <Button size="sm" variant="subtle" onClick={() => setModal("plazo")}>
                  <Plus /> Plazo
                </Button>
              </div>
            }
          >
            <PlazoList
              plazos={misPlazos}
              showExpediente={false}
              puedeEliminar={puedeEliminar}
              onEdit={(p) => setEditPlazo(p)}
              empty={<EmptyState icon={ListChecks} title="Sin plazos" description="Registre plazos procesales con cálculo en días hábiles." />}
            />
          </Panel>
        </TabsContent>

        <TabsContent value="tareas">
          <Panel title="Tareas del equipo y mías">
            <TareasExpediente expedienteId={exp.id} />
          </Panel>
        </TabsContent>

        <TabsContent value="audiencias">
          <Panel
            title="Audiencias y diligencias"
            action={
              <Button size="sm" variant="subtle" onClick={() => setModal("evento")}>
                <Plus /> Agendar
              </Button>
            }
          >
            {misEventos.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Sin eventos" description="Agende audiencias, informes orales y diligencias." />
            ) : (
              <ul className="divide-y divide-border">
                {misEventos.map((e) => (
                  <li key={e.id} className="group flex items-center gap-3 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{e.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {labelOf(TIPOS_EVENTO, e.tipo)} · {format(new Date(e.inicio), "EEE d MMM yyyy, HH:mm", { locale: es })} ·{" "}
                        {e.modalidad === "virtual" ? "Virtual" : e.lugar || "Presencial"}
                      </p>
                    </div>
                    {e.enlace && (
                      <Button asChild size="sm" variant="outline">
                        <a href={e.enlace} target="_blank" rel="noreferrer">
                          <Video /> Unirse
                        </a>
                      </Button>
                    )}
                    {puedeEliminar && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Eliminar"
                        className="pointer-fine:opacity-0 group-hover:opacity-100"
                        onClick={() => confirm("¿Eliminar este evento?") && delRow.mutate({ table: "eventos", rowId: e.id })}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="partes">
          <Panel
            title="Partes procesales"
            action={
              <Button size="sm" variant="subtle" onClick={() => setModal("parte")}>
                <Plus /> Parte
              </Button>
            }
          >
            {partes.length === 0 ? (
              <EmptyState icon={UsersRound} title="Sin partes registradas" description="Agregue demandantes, demandados, agraviados u otros." />
            ) : (
              <ul className="divide-y divide-border">
                {partes.map((p) => (
                  <li key={p.id} className="group flex items-center gap-3 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-medium">
                        {p.nombre} {p.es_cliente && <Badge variant="primary">Cliente</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.rol}
                        {p.numero_documento && ` · ${p.tipo_documento} ${p.numero_documento}`}
                        {p.abogado && ` · Abog. ${p.abogado}`}
                      </p>
                    </div>
                    <div className="flex pointer-fine:opacity-0 group-hover:opacity-100">
                      <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditParte(p)}>
                        <Pencil />
                      </Button>
                      {puedeEliminar && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Eliminar"
                          onClick={() => confirm("¿Eliminar esta parte?") && delRow.mutate({ table: "partes_procesales", rowId: p.id })}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="bitacora">
          <Panel
            title="Bitácora del expediente"
            action={
              <Button size="sm" variant="subtle" onClick={() => setModal("actuacion")}>
                <Plus /> Actuación
              </Button>
            }
          >
            {actuaciones.length === 0 ? (
              <EmptyState icon={ScrollText} title="Sin actuaciones" description="Registre resoluciones, escritos y notificaciones." />
            ) : (
              <ol className="relative ml-2 border-l border-border">
                {actuaciones.map((a) => (
                  <li key={a.id} className="group mb-5 ml-5">
                    <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-background bg-primary" />
                    <p className="text-xs text-muted-foreground">
                      {format(parseISODate(a.fecha), "d MMM yyyy", { locale: es })} ·{" "}
                      <span className="capitalize">{a.tipo}</span> · {nombreMiembro(miembros, a.created_by)}
                      {puedeEliminar && (
                        <button
                          className="ml-2 text-destructive pointer-fine:opacity-0 group-hover:opacity-100"
                          onClick={() => confirm("¿Eliminar esta actuación?") && delRow.mutate({ table: "actuaciones", rowId: a.id })}
                        >
                          Eliminar
                        </button>
                      )}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{a.descripcion}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="documentos">
          <DocumentosExpediente expedienteId={id} clienteId={exp.cliente_id} />
        </TabsContent>

        <TabsContent value="economico" className="grid gap-6 lg:grid-cols-2">
          {puedeVerFinanzas && (
            <Panel
              title="Honorarios"
              action={
                <Button size="sm" variant="subtle" onClick={() => setModal("honorario")}>
                  <Plus /> Acuerdo
                </Button>
              }
            >
              {misHonorarios.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin acuerdos vinculados a este expediente.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {misHonorarios.map((h) => {
                    const pagado = h.pagos.reduce((s, p) => s + Number(p.monto), 0);
                    return (
                      <li key={h.id} className="flex justify-between gap-3 py-2.5">
                        <span>{h.concepto}</span>
                        <span className="text-muted-foreground">
                          {formatSoles(pagado, h.moneda)} / {formatSoles(h.monto_total, h.moneda)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link to="/finanzas" className="mt-3 inline-block text-xs text-primary hover:underline">
                Registrar pagos en Honorarios y gastos
              </Link>
            </Panel>
          )}
          <Panel
            title={`Gastos · ${formatSoles(misGastos.reduce((s, g) => s + Number(g.monto), 0))}`}
            action={
              <Button size="sm" variant="subtle" onClick={() => setModal("gasto")}>
                <Plus /> Gasto
              </Button>
            }
          >
            {misGastos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin gastos registrados.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {misGastos.map((g) => (
                  <li key={g.id} className="group flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p>{g.concepto}</p>
                      <p className="text-xs text-muted-foreground">
                        {labelOf(CATEGORIAS_GASTO, g.categoria)} · {format(parseISODate(g.fecha), "d MMM yyyy", { locale: es })}
                        {g.reembolsable ? " · Reembolsable" : ""}
                      </p>
                    </div>
                    <span className="flex items-center gap-1">
                      {formatSoles(g.monto)}
                      {puedeEliminar && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Eliminar"
                          className="pointer-fine:opacity-0 group-hover:opacity-100"
                          onClick={() => confirm("¿Eliminar este gasto?") && delRow.mutate({ table: "gastos", rowId: g.id })}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      {modal === "editar" && <ExpedienteForm open expediente={exp} onOpenChange={(o) => !o && setModal(null)} />}
      {modal === "parte" && <ParteForm open expedienteId={id} onOpenChange={(o) => !o && setModal(null)} />}
      {editParte && <ParteForm open expedienteId={id} parte={editParte} onOpenChange={(o) => !o && setEditParte(null)} />}
      {modal === "actuacion" && <ActuacionForm open expedienteId={id} onOpenChange={(o) => !o && setModal(null)} />}
      {modal === "plazo" && <PlazoForm open expedienteId={id} onOpenChange={(o) => !o && setModal(null)} />}
      {modal === "plantilla" && (
        <AplicarPlantilla open plantillas={plantillas} expediente={exp} onOpenChange={(o) => !o && setModal(null)} />
      )}
      {editPlazo && <PlazoForm open expedienteId={id} plazo={editPlazo} onOpenChange={(o) => !o && setEditPlazo(null)} />}
      {modal === "evento" && <EventoForm open expedienteId={id} onOpenChange={(o) => !o && setModal(null)} />}
      {modal === "gasto" && <GastoForm open expedienteId={id} onOpenChange={(o) => !o && setModal(null)} />}
      {modal === "honorario" && (
        <HonorarioForm open expedienteId={id} clienteId={exp.cliente_id} onOpenChange={(o) => !o && setModal(null)} />
      )}
    </>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
