import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { AlertTriangle, CalendarClock, Columns3, Gavel, ListChecks, Plus, Search, Sparkles, Trash2, UserRound, Workflow } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/demo-db/client";
import { expedientesQuery, fasesQuery, miembrosQuery, nombreCliente, nombreMiembro, plantillasQuery, plazosQuery, type Expediente, type Fase } from "@/lib/queries";
import { FASES_LEGALES } from "@/lib/demo-client";
import { hoyLima } from "@/lib/cobranza";
import { labelOf, MATERIAS, parseISODate, plazoInterno, toISODate } from "@/lib/peru";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { mensajeError } from "@/lib/errors";
import { useEstudio } from "@/hooks/use-estudio";
import { calcularItems, type PlantillaConItems } from "@/components/forms/PlantillaForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, NativeSelect, PageHeader, Panel } from "@/components/app/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_estudio/tablero")({
  head: () => ({
    meta: [
      { title: "Tablero de fases — Kevelegal" },
      { name: "description", content: "Vista Kanban de los expedientes por fase, con días en cada fase y tareas automáticas." },
      { property: "og:title", content: "Tablero de fases — Kevelegal" },
      { property: "og:description", content: "Expedientes por fase en vista Kanban." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(fasesQuery(context.estudio.id)),
      context.queryClient.ensureQueryData(expedientesQuery(context.estudio.id)),
    ]);
  },
  component: TableroPage,
});

const SIN_FASE = "__sin_fase__";

function TableroPage() {
  const { estudioId, puedeEliminar } = useEstudio();
  const qc = useQueryClient();
  const { data: fases } = useSuspenseQuery(fasesQuery(estudioId));
  const { data: expedientes } = useSuspenseQuery(expedientesQuery(estudioId));
  const { data: plantillas = [] } = useQuery(plantillasQuery(estudioId));
  const [nueva, setNueva] = useState("");
  const [config, setConfig] = useState(false);
  const [over, setOver] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [materia, setMateria] = useState("");
  const [resp, setResp] = useState("");
  const [soloRiesgo, setSoloRiesgo] = useState(false);
  const { data: plazos = [] } = useQuery(plazosQuery(estudioId));
  const { data: miembros = [] } = useQuery(miembrosQuery(estudioId));
  const hoy = hoyLima();
  const riesgoDe = (expId: string) => {
    const ps = plazos.filter((p) => p.expediente_id === expId && p.estado === "pendiente").sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
    const prox = ps[0];
    if (!prox) return { pendientes: 0, prox: null, interno: null, nivel: "ok" as const };
    const interno = toISODate(plazoInterno(parseISODate(prox.fecha_vencimiento)));
    const nivel = prox.fecha_vencimiento < hoy ? ("vencido" as const) : interno <= hoy ? ("proximo" as const) : ("ok" as const);
    return { pendientes: ps.length, prox, interno, nivel };
  };
  const activos = expedientes
    .filter((e) => e.estado === "en_tramite" || e.estado === "suspendido")
    .filter((e) => !materia || e.materia === materia)
    .filter((e) => !resp || e.responsable_id === resp)
    .filter((e) => !soloRiesgo || riesgoDe(e.id).nivel !== "ok")
    .filter((e) => {
      const t = q.trim().toLowerCase();
      return !t || [e.titulo, e.numero_expediente, e.organo_jurisdiccional, nombreCliente(e.cliente)].some((v) => v?.toLowerCase().includes(t));
    });

  const crearRecomendadas = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("fases")
        .insert(FASES_LEGALES.map((nombre, i) => ({ estudio_id: estudioId, nombre, orden: fases.length + i })));
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Se crearon las 6 etapas del proceso"); },
    onError: (e) => toast.error(mensajeError(e)),
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["fases"] });
    qc.invalidateQueries({ queryKey: ["expedientes"] });
    qc.invalidateQueries({ queryKey: ["expediente"] });
  };

  const crearFase = useMutation({
    mutationFn: async (nombre: string) => {
      const { error } = await supabase
        .from("fases")
        .insert({ estudio_id: estudioId, nombre, orden: fases.length });
      if (error) throw error;
    },
    onSuccess: () => {
      setNueva("");
      invalidar();
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  const actualizarFase = useMutation({
    mutationFn: async ({ id, ...cambios }: Partial<Fase> & { id: string }) => {
      const { error } = await supabase.from("fases").update(cambios).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e) => toast.error(mensajeError(e)),
  });

  const borrarFase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e) => toast.error(mensajeError(e)),
  });

  const mover = useMutation({
    mutationFn: async ({ exp, faseId }: { exp: Expediente; faseId: string | null }) => {
      const { error } = await supabase.from("expedientes").update({ fase_id: faseId }).eq("id", exp.id);
      if (error) throw error;
      const fase = fases.find((f) => f.id === faseId);
      const plantilla = plantillas.find((p) => p.id === fase?.plantilla_id) as PlantillaConItems | undefined;
      if (plantilla && plantilla.items.length) {
        const items = calcularItems([...plantilla.items].sort((a, b) => a.orden - b.orden), toISODate(new Date()));
        const r = await supabase.rpc("aplicar_plantilla", {
          _plantilla: plantilla.id,
          _expediente: exp.id,
          _items: items,
        });
        if (r.error) throw r.error;
        return `${fase?.nombre}: se aplicó "${plantilla.nombre}" (${items.length} registros)`;
      }
      return fase ? `Movido a ${fase.nombre}` : "Movido a Sin fase";
    },
    onSuccess: (msg) => {
      invalidar();
      qc.invalidateQueries({ queryKey: ["plazos"] });
      qc.invalidateQueries({ queryKey: ["eventos"] });
      toast.success(msg);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  const columnas = [{ id: SIN_FASE, nombre: "Sin fase" } as const, ...fases];

  return (
    <>
      <PageHeader
        title="Tablero de casos"
        description="Cada tarjeta es un caso. Arrástrelo a su etapa; el plazo interno le avisa 2 días hábiles antes del vencimiento legal."
        actions={
          <Button variant="outline" onClick={() => setConfig(!config)}>
            <Workflow /> {config ? "Cerrar configuración" : "Configurar fases"}
          </Button>
        }
      />

      {(config || fases.length === 0) && (
        <Panel title="Fases del estudio" className="mb-6">
          <ul className="mb-4 space-y-2">
            {fases.map((f, i) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2">
                <span className="w-6 text-xs text-muted-foreground">{i + 1}.</span>
                <Input
                  defaultValue={f.nombre}
                  className="w-56"
                  onBlur={(e) => e.target.value && e.target.value !== f.nombre && actualizarFase.mutate({ id: f.id, nombre: e.target.value })}
                />
                <NativeSelect
                  value={f.plantilla_id ?? ""}
                  className="w-auto"
                  onChange={(e) => actualizarFase.mutate({ id: f.id, plantilla_id: e.target.value || null })}
                >
                  <option value="">Sin automatización</option>
                  {plantillas.map((p) => (
                    <option key={p.id} value={p.id}>
                      Al entrar: aplicar «{p.nombre}»
                    </option>
                  ))}
                </NativeSelect>
                {puedeEliminar && (
                  <Button size="icon" variant="ghost" aria-label="Eliminar fase" onClick={() => confirm("¿Eliminar esta fase?") && borrarFase.mutate(f.id)}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {fases.length === 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <Sparkles className="size-4 text-primary" />
              <p className="flex-1 text-sm">Empiece con las 6 etapas reales de un proceso: prospecto, redacción, presentado, probatoria, sentencia y ejecución.</p>
              <Button variant="hero" size="sm" onClick={() => crearRecomendadas.mutate()} disabled={crearRecomendadas.isPending}>
                Usar etapas recomendadas
              </Button>
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (nueva.trim()) crearFase.mutate(nueva.trim());
            }}
          >
            <Input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Ej. Postulatoria, Probatoria, Sentencia…" className="max-w-sm" />
            <Button type="submit" disabled={crearFase.isPending}>
              <Plus /> Agregar fase
            </Button>
          </form>
        </Panel>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar caso, número, juzgado o cliente" className="pl-8" aria-label="Buscar en el tablero" />
        </div>
        <NativeSelect value={materia} onChange={(e) => setMateria(e.target.value)} className="w-auto" aria-label="Materia">
          <option value="">Todas las materias</option>
          {MATERIAS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </NativeSelect>
        <NativeSelect value={resp} onChange={(e) => setResp(e.target.value)} className="w-auto" aria-label="Abogado a cargo">
          <option value="">Todo el equipo</option>
          {miembros.map((m) => <option key={m.user_id} value={m.user_id}>{m.perfil?.nombre_completo || m.perfil?.email}</option>)}
        </NativeSelect>
        <Button variant={soloRiesgo ? "destructive" : "outline"} size="sm" onClick={() => setSoloRiesgo(!soloRiesgo)}>
          <AlertTriangle /> Término próximo
        </Button>
        <div className="ml-auto flex flex-wrap gap-1.5 text-xs">
          {(["penal", "civil", "laboral", "comercial", "familia"] as const).map((m) => (
            <span key={m} className="inline-flex items-center gap-1 text-muted-foreground">
              <span className={cn("size-2 rounded-full", MATERIA_BG[m])} /> {labelOf(MATERIAS, m)}
            </span>
          ))}
        </div>
      </div>

      {activos.length === 0 ? (
        <EmptyState icon={Columns3} title="No hay expedientes que mostrar" description="Cree un expediente en trámite o cambie los filtros." />
      ) : (
        <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-4">
          {columnas.map((col, idx) => {
            const items = activos.filter((e) => (col.id === SIN_FASE ? !e.fase_id || !fases.some((f) => f.id === e.fase_id) : e.fase_id === col.id));
            if (col.id === SIN_FASE && items.length === 0 && fases.length > 0) return null;
            const enRiesgo = items.filter((e) => riesgoDe(e.id).nivel !== "ok").length;
            return (
              <div
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); setOver(col.id); }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const exp = activos.find((x) => x.id === e.dataTransfer.getData("text/plain"));
                  const destino = col.id === SIN_FASE ? null : col.id;
                  if (exp && exp.fase_id !== destino) mover.mutate({ exp, faseId: destino });
                }}
                className={cn(
                  "flex w-80 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-muted/30 transition-colors",
                  over === col.id && "border-primary bg-primary/10",
                )}
              >
                <div className={cn("h-1", ETAPA_BG[idx % ETAPA_BG.length])} />
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <h3 className="min-w-0 truncate text-sm font-semibold">
                    {col.id !== SIN_FASE && <span className="mr-1.5 text-muted-foreground">{idx}.</span>}
                    {col.nombre}
                  </h3>
                  <div className="flex items-center gap-1">
                    {enRiesgo > 0 && <Badge variant="danger"><AlertTriangle className="size-3" /> {enRiesgo}</Badge>}
                    <Badge variant="muted">{items.length}</Badge>
                  </div>
                </div>
                <div className="flex min-h-28 flex-col gap-2 px-2 pb-3">
                  {items.map((e) => {
                    const dias = differenceInCalendarDays(new Date(), new Date(e.fase_desde));
                    const r = riesgoDe(e.id);
                    const mat = (MATERIA_GRUPO[e.materia] ?? "otro") as keyof typeof MATERIA_BG;
                    return (
                      <div
                        key={e.id}
                        draggable
                        onDragStart={(ev) => ev.dataTransfer.setData("text/plain", e.id)}
                        className={cn(
                          "group cursor-grab rounded-lg border border-border bg-card p-3 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/50 active:cursor-grabbing",
                          r.nivel === "vencido" && "border-destructive/60",
                          r.nivel === "proximo" && "border-warning/60",
                        )}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", MATERIA_CHIP[mat])}>
                            {labelOf(MATERIAS, e.materia)}
                          </span>
                          {r.nivel === "vencido" && <Badge variant="danger" className="text-[10px]"><AlertTriangle className="size-3" /> Vencido</Badge>}
                          {r.nivel === "proximo" && <Badge variant="warning" className="text-[10px]"><AlertTriangle className="size-3" /> ¡Término próximo!</Badge>}
                        </div>
                        <Link to="/expedientes/$id" params={{ id: e.id }} className="block text-sm leading-snug font-medium hover:text-primary">
                          {e.titulo}
                        </Link>
                        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{e.numero_expediente || "Sin número de expediente"}</p>
                        <dl className="mt-2 grid gap-1 text-xs text-muted-foreground">
                          {e.organo_jurisdiccional && (
                            <div className="flex items-center gap-1.5 truncate"><Gavel className="size-3 shrink-0" /> <span className="truncate">{e.organo_jurisdiccional}</span></div>
                          )}
                          <div className="flex items-center gap-1.5 truncate"><UserRound className="size-3 shrink-0" /> <span className="truncate">{nombreCliente(e.cliente)} · {nombreMiembro(miembros, e.responsable_id)}</span></div>
                        </dl>
                        {r.prox && r.interno && (
                          <div className={cn(
                            "mt-2.5 rounded-md border px-2 py-1.5 text-[11px]",
                            r.nivel === "vencido" ? "border-destructive/40 bg-destructive/10" : r.nivel === "proximo" ? "border-warning/40 bg-warning/10" : "border-border bg-muted/40",
                          )}>
                            <p className="truncate font-medium text-foreground"><CalendarClock className="mr-1 inline size-3" />{r.prox.titulo}</p>
                            <p className="mt-0.5 flex justify-between gap-2 text-muted-foreground">
                              <span>Interno: <b className="text-foreground">{format(parseISODate(r.interno), "d MMM", { locale: es })}</b></span>
                              <span>Legal: {format(parseISODate(r.prox.fecha_vencimiento), "d MMM", { locale: es })}</span>
                            </p>
                          </div>
                        )}
                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><ListChecks className="size-3" /> {r.pendientes} pendiente{r.pendientes === 1 ? "" : "s"}</span>
                          {col.id !== SIN_FASE && (
                            <span className={cn(dias > 60 ? "text-destructive" : dias > 30 ? "text-warning" : "")}>
                              {dias === 0 ? "Hoy en esta etapa" : `${dias} d en esta etapa`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Arrastre un caso aquí</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

const ETAPA_BG = ["bg-muted-foreground/40", "bg-materia-publico", "bg-materia-civil", "bg-primary", "bg-materia-familia", "bg-materia-penal", "bg-materia-laboral"];

const MATERIA_GRUPO: Record<string, string> = {
  penal: "penal", civil: "civil", laboral: "laboral", comercial: "comercial", tributario: "comercial", arbitraje: "comercial",
  familia: "familia", constitucional: "publico", contencioso_administrativo: "publico", administrativo: "publico",
};
const MATERIA_BG = {
  penal: "bg-materia-penal", civil: "bg-materia-civil", laboral: "bg-materia-laboral", comercial: "bg-materia-comercial",
  familia: "bg-materia-familia", publico: "bg-materia-publico", otro: "bg-materia-otro",
} as const;
const MATERIA_CHIP = {
  penal: "bg-materia-penal/15 text-materia-penal", civil: "bg-materia-civil/15 text-materia-civil",
  laboral: "bg-materia-laboral/15 text-materia-laboral", comercial: "bg-materia-comercial/15 text-materia-comercial",
  familia: "bg-materia-familia/15 text-materia-familia", publico: "bg-materia-publico/15 text-materia-publico",
  otro: "bg-materia-otro/15 text-materia-otro",
} as const;
