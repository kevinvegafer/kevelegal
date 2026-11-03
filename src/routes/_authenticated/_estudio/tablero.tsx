import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { Columns3, Plus, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { expedientesQuery, fasesQuery, nombreCliente, plantillasQuery, type Expediente, type Fase } from "@/lib/queries";
import { toISODate } from "@/lib/peru";
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
  const activos = expedientes.filter((e) => e.estado === "en_tramite" || e.estado === "suspendido");

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
        title="Tablero de fases"
        description="Arrastre cada expediente a su fase. Si la fase tiene una plantilla, sus tareas se crean solas."
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

      {activos.length === 0 ? (
        <EmptyState icon={Columns3} title="No hay expedientes en trámite" description="Cree un expediente para verlo en el tablero." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columnas.map((col) => {
            const items = activos.filter((e) => (col.id === SIN_FASE ? !e.fase_id || !fases.some((f) => f.id === e.fase_id) : e.fase_id === col.id));
            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(col.id);
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const exp = activos.find((x) => x.id === e.dataTransfer.getData("text/plain"));
                  const destino = col.id === SIN_FASE ? null : col.id;
                  if (exp && exp.fase_id !== destino) mover.mutate({ exp, faseId: destino });
                }}
                className={cn(
                  "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/40 p-3 transition-colors",
                  over === col.id && "border-primary bg-accent/40",
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{col.nombre}</h3>
                  <Badge variant="muted">{items.length}</Badge>
                </div>
                <div className="flex min-h-24 flex-col gap-2">
                  {items.map((e) => {
                    const dias = differenceInCalendarDays(new Date(), new Date(e.fase_desde));
                    return (
                      <div
                        key={e.id}
                        draggable
                        onDragStart={(ev) => ev.dataTransfer.setData("text/plain", e.id)}
                        className="cursor-grab rounded-lg border border-border bg-card p-3 shadow-card active:cursor-grabbing"
                      >
                        <Link to="/expedientes/$id" params={{ id: e.id }} className="text-sm font-medium hover:underline">
                          {e.titulo}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {e.numero_expediente || "Sin número"} · {nombreCliente(e.cliente)}
                        </p>
                        {col.id !== SIN_FASE && (
                          <Badge variant={dias > 60 ? "danger" : dias > 30 ? "warning" : "muted"} className="mt-2">
                            {dias === 0 ? "Hoy en esta fase" : `${dias} d en esta fase`}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
