import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, CornerDownRight, Link2, ListPlus, Lock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { miembrosQuery, nombreMiembro, plazosQuery, type Plazo } from "@/lib/queries";
import { parseISODate } from "@/lib/peru";
import { agruparSubtareas, estaBloqueada, reprogramarDependientes } from "@/lib/tareas";
import { mensajeError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useEstudio } from "@/hooks/use-estudio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlazoForm } from "@/components/forms/AgendaForms";

export type PlazoConExp = Plazo & {
  expediente?: { id: string; titulo: string; numero_expediente: string | null } | null;
};

export function urgencia(p: Plazo) {
  if (p.estado === "completado") return { label: "Completado", variant: "muted" as const };
  const d = differenceInCalendarDays(parseISODate(p.fecha_vencimiento), new Date());
  if (d < 0) return { label: `Vencido hace ${-d} d`, variant: "danger" as const };
  if (d === 0) return { label: "Vence hoy", variant: "danger" as const };
  if (d <= 3) return { label: `En ${d} d`, variant: "warning" as const };
  return { label: `En ${d} d`, variant: "muted" as const };
}

export function PlazoList({
  plazos,
  showExpediente = true,
  onEdit,
  puedeEliminar,
  empty,
}: {
  plazos: PlazoConExp[];
  showExpediente?: boolean;
  onEdit?: (p: PlazoConExp) => void;
  puedeEliminar?: boolean;
  empty?: React.ReactNode;
}) {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  // All studio tasks: needed to resolve dependencies outside the filtered list.
  const { data: todas = [] } = useQuery(plazosQuery(estudioId));
  const { data: miembros = [] } = useQuery(miembrosQuery(estudioId));
  const [subDe, setSubDe] = useState<PlazoConExp | null>(null);

  const toggle = useMutation({
    mutationFn: async (p: Plazo) => {
      const completado = p.estado !== "completado";
      const { error } = await supabase
        .from("plazos")
        .update({
          estado: completado ? "completado" : "pendiente",
          completado_at: completado ? new Date().toISOString() : null,
        })
        .eq("id", p.id);
      if (error) throw error;
      let movidas = 0;
      if (completado) {
        const cambios = reprogramarDependientes(p.id, todas, new Date());
        for (const c of cambios) {
          const r = await supabase.from("plazos").update({ fecha_vencimiento: c.fecha_vencimiento }).eq("id", c.id);
          if (r.error) throw r.error;
          movidas++;
        }
      }
      return { completado, movidas };
    },
    onSuccess: ({ completado, movidas }) => {
      qc.invalidateQueries({ queryKey: ["plazos"] });
      qc.invalidateQueries({ queryKey: ["avisos"] });
      toast.success(
        completado
          ? movidas
            ? `Completado · ${movidas} tarea${movidas > 1 ? "s" : ""} dependiente${movidas > 1 ? "s" : ""} reprogramada${movidas > 1 ? "s" : ""}`
            : "Marcado como completado"
          : "Reabierto",
      );
    },
    onError: (e) => toast.error(mensajeError(e)),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plazos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plazos"] });
      toast.success("Eliminado");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  if (plazos.length === 0) return <>{empty}</>;

  const grupos = agruparSubtareas(plazos);

  function fila(p: PlazoConExp, nivel: 0 | 1) {
    const u = urgencia(p);
    const done = p.estado === "completado";
    const bloqueo = estaBloqueada(p, todas);
    const previa = p.depende_de ? todas.find((x) => x.id === p.depende_de) : undefined;
    const subtareas = todas.filter((x) => x.parent_id === p.id);
    const hechas = subtareas.filter((x) => x.estado === "completado").length;
    return (
      <li key={p.id} className={cn("group flex items-start gap-3 py-3", nivel === 1 && "pl-8")}>
        {nivel === 1 && <CornerDownRight className="mt-0.5 -ml-6 size-4 shrink-0 text-muted-foreground" />}
        <button
          aria-label={done ? "Reabrir" : "Marcar completado"}
          onClick={() => {
            if (!done && bloqueo && !confirm(`Esta tarea espera a "${bloqueo.titulo}". ¿Completarla de todos modos?`)) return;
            toggle.mutate(p);
          }}
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded border transition-colors",
            done ? "border-success bg-success text-success-foreground" : "border-input hover:border-primary",
          )}
        >
          {done && <Check className="size-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>{p.titulo}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{p.tipo === "plazo_procesal" ? "Plazo procesal" : "Tarea"}</span>
            <span>·</span>
            <span>{format(parseISODate(p.fecha_vencimiento), "EEE d MMM yyyy", { locale: es })}</span>
            {p.dias_habiles ? <span>· {p.dias_habiles} días hábiles</span> : null}
            <span>· {nombreMiembro(miembros, p.asignado_a)}</span>
            {subtareas.length > 0 && (
              <span>
                · {hechas}/{subtareas.length} subtareas
              </span>
            )}
            {showExpediente && p.expediente && (
              <>
                <span>·</span>
                <Link to="/expedientes/$id" params={{ id: p.expediente.id }} className="truncate text-primary hover:underline">
                  {p.expediente.numero_expediente || p.expediente.titulo}
                </Link>
              </>
            )}
          </p>
          {previa && !done && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              {bloqueo ? <Lock className="size-3" /> : <Link2 className="size-3" />}
              {bloqueo ? "Espera a" : "Dependía de"}: {previa.titulo}
              {p.desfase_dias > 0 ? ` · se mueve a ${p.desfase_dias} día${p.desfase_dias > 1 ? "s" : ""} hábil${p.desfase_dias > 1 ? "es" : ""} después` : ""}
            </p>
          )}
        </div>
        <Badge variant={bloqueo && !done ? "outline" : u.variant}>{bloqueo && !done ? "En espera" : u.label}</Badge>
        <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {nivel === 0 && !done && (
            <Button size="icon" variant="ghost" aria-label="Agregar subtarea" onClick={() => setSubDe(p)}>
              <ListPlus />
            </Button>
          )}
          {onEdit && (
            <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => onEdit(p)}>
              <Pencil />
            </Button>
          )}
          {puedeEliminar && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Eliminar"
              onClick={() => {
                const extra = subtareas.length ? ` También se eliminarán ${subtareas.length} subtareas.` : "";
                if (confirm(`¿Eliminar este plazo?${extra}`)) del.mutate(p.id);
              }}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </li>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {grupos.map(({ tarea, hijas }) => [fila(tarea, 0), ...hijas.map((h) => fila(h, 1))])}
      </ul>
      {subDe && (
        <PlazoForm
          open
          onOpenChange={(o) => !o && setSubDe(null)}
          parentId={subDe.id}
          {...(subDe.expediente_id ? { expedienteId: subDe.expediente_id } : {})}
        />
      )}
    </>
  );
}
