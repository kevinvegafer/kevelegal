import { useMemo, useRef, useState, type DragEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Download,
  FolderKanban,
  Globe2,
  Lock,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { useEstudio } from "@/hooks/use-estudio";
import { expedientesQuery, plazosQuery, type Plazo } from "@/lib/queries";
import { supabase } from "@/lib/demo-db/client";
import { hoyLima } from "@/lib/cobranza";
import { parseISODate } from "@/lib/peru";
import { cn } from "@/lib/utils";
import {
  actualizarTarea,
  COLUMNAS,
  crearTarea,
  eliminarTarea,
  grupoDe,
  GRUPOS,
  leerArchivo,
  tareasQuery,
  type Adjunto,
  type Columna,
  type Grupo,
  type Prioridad,
  type Tarea,
  type Visibilidad,
} from "@/lib/mis-tareas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/app/ui";

export type FiltroVisibilidad = "todas" | "privada" | "estudio";

/** Tareas visibles + plazos asignados al abogado, siempre sincronizados. */
export function useMisTareas() {
  const { estudioId, user } = useEstudio();
  const tareas = useQuery(tareasQuery(estudioId, user.id));
  const plazos = useQuery(plazosQuery(estudioId));
  const expedientes = useQuery(expedientesQuery(estudioId));
  const misPlazos = (plazos.data ?? []).filter(
    (p) => p.estado === "pendiente" && (p.asignado_a === user.id || !p.asignado_a),
  );
  const plazosCumplidos = (plazos.data ?? []).filter(
    (p) => p.estado === "completado" && (p.asignado_a === user.id || !p.asignado_a),
  );
  return {
    tareas: tareas.data ?? [],
    misPlazos,
    plazosCumplidos,
    expedientes: expedientes.data ?? [],
    userId: user.id,
    estudioId,
  };
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["mis-tareas"] });
    void qc.invalidateQueries({ queryKey: ["plazos"] });
  };
}

export function useMoverTarea() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { id: string; patch: Partial<Tarea> }) => actualizarTarea(v.id, v.patch),
    onSuccess: invalidar,
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
  });
}

export function useEliminarTarea() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (t: Tarea) => {
      if (!window.confirm(`¿Eliminar la tarea «${t.titulo}»? No se puede deshacer.`)) return false;
      await eliminarTarea(t.id);
      return true;
    },
    onSuccess: (borrada) => {
      if (!borrada) return;
      invalidar();
      toast.success("Tarea eliminada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });
}

function Acciones({ tarea, onEdit }: { tarea: Tarea; onEdit: () => void }) {
  const { user } = useEstudio();
  const eliminar = useEliminarTarea();
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button type="button" aria-label={`Editar ${tarea.titulo}`} onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
        <Pencil className="size-3.5" />
      </button>
      {tarea.created_by === user.id && (
        <button type="button" aria-label={`Eliminar ${tarea.titulo}`} onClick={(e) => { e.stopPropagation(); eliminar.mutate(tarea); }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function useCompletarPlazo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (p: Plazo) => {
      const { error } = await supabase
        .from("plazos")
        .update({ estado: "completado", completado_at: new Date().toISOString() })
        .eq("id", p.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidar();
      toast.success("Plazo marcado como cumplido");
    },
  });
}

const PRIORIDAD_VARIANTE = { alta: "danger", media: "warning", baja: "muted" } as const;

function fechaCorta(f: string | null) {
  if (!f) return "Algún día";
  return format(parseISODate(f), "EEE d MMM", { locale: es });
}

function VisIcon({ v }: { v: Visibilidad }) {
  return v === "privada" ? (
    <Lock className="size-3" aria-label="Privada" />
  ) : (
    <Globe2 className="size-3" aria-label="Compartida con el estudio" />
  );
}

/* ---------------- Fila de enfoque ---------------- */

export function TareaFila({
  tarea,
  proyecto,
  onOpen,
}: {
  tarea: Tarea;
  proyecto?: string | undefined;
  onOpen: () => void;
}) {
  const mover = useMoverTarea();
  const hecha = tarea.columna === "hecho";
  const vencida = !hecha && tarea.fecha && tarea.fecha < hoyLima();
  return (
    <li className="group flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/50">
      <button
        type="button"
        aria-label={hecha ? "Marcar como pendiente" : "Marcar como hecha"}
        onClick={() => mover.mutate({ id: tarea.id, patch: { columna: hecha ? "por_hacer" : "hecho" } })}
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
          hecha ? "border-success bg-success text-success-foreground" : "border-muted-foreground/50 hover:border-primary",
        )}
      >
        {hecha && <Check className="size-3" />}
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className={cn("truncate text-sm font-medium", hecha && "text-muted-foreground line-through")}>{tarea.titulo}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className={cn("inline-flex items-center gap-1", vencida && "text-destructive")}>
            <CalendarDays className="size-3" /> {fechaCorta(tarea.fecha)}
          </span>
          {proyecto && (
            <span className="inline-flex items-center gap-1 truncate">
              <FolderKanban className="size-3" /> {proyecto}
            </span>
          )}
          {tarea.adjuntos.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="size-3" /> {tarea.adjuntos.length}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <VisIcon v={tarea.visibilidad} /> {tarea.visibilidad === "privada" ? "Privada" : "Estudio"}
          </span>
        </div>
      </button>
      <Badge variant={PRIORIDAD_VARIANTE[tarea.prioridad]} className="shrink-0 capitalize">
        {tarea.prioridad}
      </Badge>
      <Acciones tarea={tarea} onEdit={onOpen} />
    </li>
  );
}

export function PlazoFila({ plazo }: { plazo: Plazo & { expediente?: { id: string; titulo: string; numero_expediente: string | null } | null } }) {
  const completar = useCompletarPlazo();
  const vencido = plazo.fecha_vencimiento < hoyLima();
  return (
    <li className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
      <button
        type="button"
        aria-label="Marcar plazo como cumplido"
        onClick={() => completar.mutate(plazo)}
        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-destructive/60 hover:bg-destructive/20"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{plazo.titulo}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          <span className={cn("inline-flex items-center gap-1", vencido && "text-destructive")}>
            <CalendarDays className="size-3" /> {fechaCorta(plazo.fecha_vencimiento)}
          </span>
          {plazo.expediente && (
            <Link to="/expedientes/$id" params={{ id: plazo.expediente.id }} className="truncate text-primary hover:underline">
              {plazo.expediente.numero_expediente || plazo.expediente.titulo}
            </Link>
          )}
        </div>
      </div>
      <Badge variant="danger" className="shrink-0">Plazo legal</Badge>
    </li>
  );
}

/* ---------------- Vista Enfoque ---------------- */

export function VistaEnfoque({
  tareas,
  plazos,
  nombreProyecto,
  onOpen,
  onNueva,
  mostrarHechas,
}: {
  tareas: Tarea[];
  plazos: Plazo[];
  nombreProyecto: (id: string | null) => string | undefined;
  onOpen: (t: Tarea) => void;
  onNueva: (g: Grupo) => void;
  mostrarHechas: boolean;
}) {
  const hoy = hoyLima();
  const pendientes = tareas.filter((t) => t.columna !== "hecho");
  const hechas = tareas.filter((t) => t.columna === "hecho");
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {GRUPOS.map((g) => {
        const ts = pendientes.filter((t) => grupoDe(t.fecha, hoy) === g.value);
        const ps = plazos.filter((p) => grupoDe(p.fecha_vencimiento, hoy) === g.value);
        const total = ts.length + ps.length;
        return (
          <section
            key={g.value}
            className={cn(
              "rounded-xl border border-border bg-card/60 p-4 shadow-card",
              g.value === "vencidas" && total > 0 && "border-destructive/40",
              g.value === "hoy" && "border-primary/40",
            )}
          >
            <header className="mb-3 flex items-center justify-between">
              <h3 className={cn("text-sm font-semibold", g.value === "vencidas" && total > 0 && "text-destructive", g.value === "hoy" && "text-primary")}>
                {g.label} <span className="ml-1 text-muted-foreground">{total}</span>
              </h3>
              {g.value !== "vencidas" && (
                <Button size="sm" variant="ghost" onClick={() => onNueva(g.value)}>
                  <Plus /> Añadir
                </Button>
              )}
            </header>
            {total === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">Nada aquí.</p>
            ) : (
              <ul className="grid gap-2">
                {ps.map((p) => <PlazoFila key={p.id} plazo={p} />)}
                {ts.map((t) => (
                  <TareaFila key={t.id} tarea={t} proyecto={nombreProyecto(t.expediente_id)} onOpen={() => onOpen(t)} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {mostrarHechas && hechas.length > 0 && (
        <section className="rounded-xl border border-border bg-card/60 p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-success">Completadas <span className="text-muted-foreground">{hechas.length}</span></h3>
          <ul className="grid gap-2 lg:grid-cols-2">
            {hechas.map((t) => (
              <TareaFila key={t.id} tarea={t} proyecto={nombreProyecto(t.expediente_id)} onOpen={() => onOpen(t)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ---------------- Historial de completadas ---------------- */

export function Historial({
  tareas,
  plazosCumplidos,
  nombreProyecto,
  onOpen,
}: {
  tareas: Tarea[];
  plazosCumplidos: Plazo[];
  nombreProyecto: (id: string | null) => string | undefined;
  onOpen: (t: Tarea) => void;
}) {
  const mover = useMoverTarea();
  const [q, setQ] = useState("");
  type Item = { id: string; cuando: string; titulo: string; tarea?: Tarea; plazo?: Plazo };
  const items: Item[] = [
    ...tareas.filter((t) => t.columna === "hecho").map((t) => ({ id: t.id, cuando: t.completada_at ?? t.updated_at, titulo: t.titulo, tarea: t })),
    ...plazosCumplidos.map((p) => ({ id: p.id, cuando: p.completado_at ?? p.updated_at, titulo: p.titulo, plazo: p })),
  ]
    .filter((i) => i.titulo.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.cuando.localeCompare(a.cuando));
  const dias = new Map<string, Item[]>();
  for (const i of items) {
    const k = i.cuando.slice(0, 10);
    dias.set(k, [...(dias.get(k) ?? []), i]);
  }
  return (
    <div className="grid gap-5">
      <Input placeholder="Buscar en el historial…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" aria-label="Buscar en el historial" />
      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Aún no hay tareas completadas.
        </p>
      )}
      {[...dias.entries()].map(([dia, lista]) => (
        <section key={dia}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground first-letter:uppercase">
            {format(parseISODate(dia), "EEEE d 'de' MMMM yyyy", { locale: es })} · {lista.length}
          </h3>
          <ul className="grid gap-2">
            {lista.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success text-success-foreground"><Check className="size-3" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-muted-foreground line-through">{i.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    Completada a las {format(new Date(i.cuando), "HH:mm")}
                    {i.plazo ? " · Plazo legal" : i.tarea && nombreProyecto(i.tarea.expediente_id) ? ` · ${nombreProyecto(i.tarea.expediente_id)}` : ""}
                  </p>
                </div>
                {i.tarea && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => mover.mutate({ id: i.tarea!.id, patch: { columna: "por_hacer" } })}>
                      <RotateCcw /> Reabrir
                    </Button>
                    <Acciones tarea={i.tarea} onEdit={() => onOpen(i.tarea!)} />
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ---------------- Tablero tipo Trello ---------------- */

type Carril = { id: string; label: string; match: (t: Tarea) => boolean; patch: Partial<Tarea> };

export function Tablero({
  tareas,
  carriles,
  nombreProyecto,
  onOpen,
  onNueva,
}: {
  tareas: Tarea[];
  carriles: Carril[];
  nombreProyecto: (id: string | null) => string | undefined;
  onOpen: (t: Tarea) => void;
  onNueva: (patch: Partial<Tarea>) => void;
}) {
  const mover = useMoverTarea();
  const [sobre, setSobre] = useState<string | null>(null);
  const arrastrando = useRef<string | null>(null);

  function soltar(e: DragEvent, c: Carril) {
    e.preventDefault();
    setSobre(null);
    const id = arrastrando.current ?? e.dataTransfer.getData("text/plain");
    arrastrando.current = null;
    const t = tareas.find((x) => x.id === id);
    if (t && !c.match(t)) mover.mutate({ id, patch: { ...c.patch, orden: Date.now() } });
  }

  return (
    <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-4">
      {carriles.map((c) => {
        const ts = tareas.filter(c.match);
        return (
          <section
            key={c.id}
            onDragOver={(e) => { e.preventDefault(); setSobre(c.id); }}
            onDragLeave={() => setSobre((s) => (s === c.id ? null : s))}
            onDrop={(e) => soltar(e, c)}
            className={cn(
              "flex w-72 shrink-0 snap-start flex-col rounded-xl border border-border bg-muted/40 transition-colors",
              sobre === c.id && "border-primary bg-primary/10",
            )}
          >
            <header className="flex items-center justify-between px-3 py-2.5">
              <h3 className="truncate text-sm font-semibold">
                {c.label} <span className="ml-1 text-muted-foreground">{ts.length}</span>
              </h3>
            </header>
            <ul className="grid min-h-16 gap-2 px-2 pb-2">
              {ts.map((t) => (
                <li
                  key={t.id}
                  draggable
                  onDragStart={(e) => { arrastrando.current = t.id; e.dataTransfer.setData("text/plain", t.id); }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(t)}
                    onKeyDown={(e) => { if (e.key === "Enter") onOpen(t); }}
                    className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-card transition-colors hover:border-primary/60"
                  >
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-8 rounded-full", t.prioridad === "alta" ? "bg-destructive" : t.prioridad === "media" ? "bg-warning" : "bg-muted-foreground/40")} />
                      <span className="ml-auto text-muted-foreground"><VisIcon v={t.visibilidad} /></span>
                      <span onClick={(e) => e.stopPropagation()}><Acciones tarea={t} onEdit={() => onOpen(t)} /></span>
                    </div>
                    <p className={cn("text-sm font-medium", t.columna === "hecho" && "text-muted-foreground line-through")}>{t.titulo}</p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className={cn("inline-flex items-center gap-1", t.columna !== "hecho" && t.fecha && t.fecha < hoyLima() && "text-destructive")}>
                        <CalendarDays className="size-3" /> {fechaCorta(t.fecha)}
                      </span>
                      {t.adjuntos.length > 0 && (
                        <span className="inline-flex items-center gap-1"><Paperclip className="size-3" /> {t.adjuntos.length}</span>
                      )}
                    </div>
                    {nombreProyecto(t.expediente_id) && (
                      <p className="mt-2 truncate text-xs text-primary">{nombreProyecto(t.expediente_id)}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" className="mx-2 mb-2 justify-start" onClick={() => onNueva(c.patch)}>
              <Plus /> Añadir tarjeta
            </Button>
          </section>
        );
      })}
    </div>
  );
}

export const carrilesPorEstado: Carril[] = COLUMNAS.map((c) => ({
  id: c.value,
  label: c.label,
  match: (t) => t.columna === c.value,
  patch: { columna: c.value },
}));

export function carrilesPorProyecto(expedientes: { id: string; titulo: string; numero_expediente: string | null }[], tareas: Tarea[]): Carril[] {
  const usados = new Set(tareas.map((t) => t.expediente_id).filter(Boolean));
  return [
    { id: "personal", label: "Personal / sin expediente", match: (t) => !t.expediente_id, patch: { expediente_id: null } },
    ...expedientes
      .filter((e) => usados.has(e.id))
      .map((e) => ({
        id: e.id,
        label: e.titulo,
        match: (t: Tarea) => t.expediente_id === e.id,
        patch: { expediente_id: e.id },
      })),
  ];
}

/* ---------------- Diálogo de tarea ---------------- */

function formatoTamano(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function TareaDialog({
  open,
  onOpenChange,
  tarea,
  inicial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tarea?: Tarea | null | undefined;
  inicial?: Partial<Tarea> | undefined;
}) {
  const { estudioId, user } = useEstudio();
  const { data: expedientes = [] } = useQuery(expedientesQuery(estudioId));
  const invalidar = useInvalidar();
  const base = { ...inicial, ...tarea };
  const [titulo, setTitulo] = useState(base.titulo ?? "");
  const [notas, setNotas] = useState(base.notas ?? "");
  const [fecha, setFecha] = useState(base.fecha ?? "");
  const [expedienteId, setExpedienteId] = useState(base.expediente_id ?? "");
  const [columna, setColumna] = useState<Columna>(base.columna ?? "por_hacer");
  const [prioridad, setPrioridad] = useState<Prioridad>(base.prioridad ?? "media");
  const [visibilidad, setVisibilidad] = useState<Visibilidad>(base.visibilidad ?? "privada");
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>(base.adjuntos ?? []);
  const fileRef = useRef<HTMLInputElement>(null);
  const esAutor = !tarea || tarea.created_by === user.id;

  const guardar = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error("Escriba un título");
      const v = {
        titulo: titulo.trim(), notas: notas.trim() || null, fecha: fecha || null,
        expediente_id: expedienteId || null, columna, prioridad, visibilidad, adjuntos,
      };
      if (tarea) await actualizarTarea(tarea.id, v);
      else await crearTarea({ ...v, estudio_id: estudioId, created_by: user.id });
    },
    onSuccess: () => {
      invalidar();
      toast.success(tarea ? "Tarea actualizada" : "Tarea creada");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const eliminar = useEliminarTarea();
  const borrar = { mutate: () => eliminar.mutate(tarea!, { onSuccess: (b) => b && onOpenChange(false) }) };

  async function subir(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      try {
        const a = await leerArchivo(f);
        setAdjuntos((prev) => [...prev, a]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo subir");
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form
          className="grid gap-5"
          onSubmit={(e) => { e.preventDefault(); guardar.mutate(); }}
        >
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{tarea ? "Tarea" : "Nueva tarea"}</DialogTitle>
          </DialogHeader>

          <Input
            autoFocus
            aria-label="Título"
            placeholder="¿Qué hay que hacer?"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="h-11 text-base"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha" hint="Déjela vacía para «Algún día»" htmlFor="t-fecha">
              <div className="flex gap-2">
                <Input id="t-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                {fecha && <Button type="button" variant="ghost" size="sm" onClick={() => setFecha("")}>Quitar</Button>}
              </div>
            </Field>
            <Field label="Expediente / proyecto" htmlFor="t-exp">
              <NativeSelect id="t-exp" value={expedienteId} onChange={(e) => setExpedienteId(e.target.value)}>
                <option value="">Personal (sin expediente)</option>
                {expedientes.map((x) => (
                  <option key={x.id} value={x.id}>{x.titulo}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Columna" htmlFor="t-col">
              <NativeSelect id="t-col" value={columna} onChange={(e) => setColumna(e.target.value as Columna)}>
                {COLUMNAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Prioridad" htmlFor="t-pri">
              <NativeSelect id="t-pri" value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)}>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </NativeSelect>
            </Field>
          </div>

          <Field label="¿Quién la ve?">
            <div className="grid grid-cols-2 gap-2">
              {(["privada", "estudio"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={!esAutor}
                  onClick={() => setVisibilidad(v)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50",
                    visibilidad === v ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50",
                  )}
                >
                  <VisIcon v={v} />
                  <span>
                    <span className="block font-medium">{v === "privada" ? "Solo yo" : "Todo el estudio"}</span>
                    <span className="block text-xs text-muted-foreground">{v === "privada" ? "Privada para usted" : "Compartida con el equipo"}</span>
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Notas" htmlFor="t-notas">
            <Textarea id="t-notas" rows={4} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Detalles, pasos, enlaces…" />
          </Field>

          <Field label={`Documentos (${adjuntos.length})`}>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); void subir(e.dataTransfer.files); }}
              className="grid gap-2 rounded-lg border border-dashed border-border p-3"
            >
              {adjuntos.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
                  <span className="text-xs text-muted-foreground">{formatoTamano(a.tamano)}</span>
                  <a href={a.dataUrl} download={a.nombre} aria-label={`Descargar ${a.nombre}`} className="rounded p-1 text-muted-foreground hover:text-primary">
                    <Download className="size-3.5" />
                  </a>
                  <button type="button" aria-label={`Quitar ${a.nombre}`} onClick={() => setAdjuntos((p) => p.filter((x) => x.id !== a.id))} className="rounded p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              <input ref={fileRef} type="file" multiple hidden onChange={(e) => void subir(e.target.files)} />
              <Button type="button" variant="subtle" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload /> Subir documentos
              </Button>
              <p className="text-center text-xs text-muted-foreground">O arrástrelos aquí · hasta 2 MB cada uno en modo demo</p>
            </div>
          </Field>

          <DialogFooter className="gap-2 sm:justify-between">
            {tarea && esAutor ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => borrar.mutate()}>
                <Trash2 /> Eliminar
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" variant="hero" disabled={guardar.isPending}>
                {guardar.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Resumen para el panel ---------------- */

export function ResumenMisTareas() {
  const { tareas, misPlazos, expedientes } = useMisTareas();
  const [abierta, setAbierta] = useState<Tarea | null>(null);
  const [nueva, setNueva] = useState(false);
  const hoy = hoyLima();
  const pendientes = tareas.filter((t) => t.columna !== "hecho");
  const cuenta = useMemo(() => {
    const c: Record<Grupo, number> = { vencidas: 0, hoy: 0, manana: 0, semana: 0, planificadas: 0, algun_dia: 0 };
    for (const t of pendientes) c[grupoDe(t.fecha, hoy)]++;
    for (const p of misPlazos) c[grupoDe(p.fecha_vencimiento, hoy)]++;
    return c;
  }, [pendientes, misPlazos, hoy]);
  const urgentes = pendientes.filter((t) => { const g = grupoDe(t.fecha, hoy); return g === "vencidas" || g === "hoy"; });
  const plazosUrg = misPlazos.filter((p) => p.fecha_vencimiento <= hoy);
  const proyecto = (id: string | null) => expedientes.find((e) => e.id === id)?.titulo;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-semibold tracking-wide">Plazos y tareas</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="subtle" onClick={() => setNueva(true)}><Plus /> Tarea</Button>
          <Button size="sm" variant="outline" asChild><Link to="/plazos">Abrir tablero</Link></Button>
        </div>
      </header>
      <div className="grid gap-4 p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {GRUPOS.map((g) => (
            <Link
              key={g.value}
              to="/plazos"
              className={cn(
                "rounded-lg border border-border px-2 py-2 text-center transition-colors hover:border-primary/60",
                g.value === "vencidas" && cuenta.vencidas > 0 && "border-destructive/40 bg-destructive/5 text-destructive",
                g.value === "hoy" && "border-primary/40 bg-primary/5 text-primary",
              )}
            >
              <p className="text-xl font-semibold">{cuenta[g.value]}</p>
              <p className="truncate text-[11px] text-muted-foreground">{g.label}</p>
            </Link>
          ))}
        </div>
        {urgentes.length + plazosUrg.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">Nada vencido ni para hoy. Buen trabajo.</p>
        ) : (
          <ul className="grid gap-2">
            {plazosUrg.slice(0, 3).map((p) => <PlazoFila key={p.id} plazo={p} />)}
            {urgentes.slice(0, 5).map((t) => (
              <TareaFila key={t.id} tarea={t} proyecto={proyecto(t.expediente_id)} onOpen={() => setAbierta(t)} />
            ))}
          </ul>
        )}
      </div>
      {nueva && <TareaDialog open onOpenChange={setNueva} inicial={{ fecha: hoy }} />}
      {abierta && <TareaDialog open tarea={abierta} onOpenChange={(o) => !o && setAbierta(null)} />}
    </section>
  );
}

/* ---------------- Tareas dentro de un expediente ---------------- */

export function TareasExpediente({ expedienteId }: { expedienteId: string }) {
  const { tareas } = useMisTareas();
  const [abierta, setAbierta] = useState<Tarea | null>(null);
  const [nueva, setNueva] = useState(false);
  const mias = tareas.filter((t) => t.expediente_id === expedienteId);
  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <Button size="sm" variant="subtle" onClick={() => setNueva(true)}><Plus /> Tarea</Button>
      </div>
      {mias.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Sin tareas para este expediente.</p>
      ) : (
        <ul className="grid gap-2">
          {mias.map((t) => <TareaFila key={t.id} tarea={t} onOpen={() => setAbierta(t)} />)}
        </ul>
      )}
      {nueva && <TareaDialog open onOpenChange={setNueva} inicial={{ expediente_id: expedienteId }} />}
      {abierta && <TareaDialog open tarea={abierta} onOpenChange={(o) => !o && setAbierta(null)} />}
    </div>
  );
}
