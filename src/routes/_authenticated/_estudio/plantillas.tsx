import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, ListChecks, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/demo-db/client";
import { plantillasQuery } from "@/lib/queries";
import { TIPOS_EVENTO, labelOf } from "@/lib/peru";
import { mensajeError } from "@/lib/errors";
import { useEstudio } from "@/hooks/use-estudio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { PlantillaForm, type PlantillaConItems } from "@/components/forms/PlantillaForms";

export const Route = createFileRoute("/_authenticated/_estudio/plantillas")({
  head: () => ({
    meta: [
      { title: "Plantillas de procesos — Kevelegal" },
      { name: "description", content: "Listas de tareas y eventos estándar que se aplican a un expediente con un clic." },
      { property: "og:title", content: "Plantillas de procesos — Kevelegal" },
      { property: "og:description", content: "Automatice tareas y eventos recurrentes del estudio." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(plantillasQuery(context.estudio.id)),
  component: PlantillasPage,
});

function PlantillasPage() {
  const { estudioId, puedeEliminar } = useEstudio();
  const qc = useQueryClient();
  const { data: plantillas } = useSuspenseQuery(plantillasQuery(estudioId));
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<PlantillaConItems | null>(null);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plantillas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plantillas"] });
      toast.success("Plantilla eliminada");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  return (
    <>
      <PageHeader
        title="Plantillas de procesos"
        description="Defina una vez las tareas y eventos de cada trámite. Luego aplíquelas a cualquier expediente con un solo clic y las fechas se calculan solas."
        actions={
          <Button variant="hero" onClick={() => setModal(true)}>
            <Plus /> Nueva plantilla
          </Button>
        }
      />

      {plantillas.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Sin plantillas"
          description="Cree su primera plantilla: por ejemplo, «Notificación de traslado» con las tareas de siempre."
          action={
            <Button variant="hero" onClick={() => setModal(true)}>
              <Plus /> Nueva plantilla
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {plantillas.map((p) => {
            const items = [...p.items].sort((a, b) => a.orden - b.orden);
            const tareas = items.filter((i) => i.tipo !== "evento");
            const eventos = items.filter((i) => i.tipo === "evento");
            return (
              <section key={p.id} className="rounded-xl border border-border bg-card shadow-card">
                <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
                  <div className="min-w-0">
                    <h2 className="truncate font-sans text-sm font-semibold tracking-wide">{p.nombre}</h2>
                    {p.descripcion && <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.descripcion}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEdit(p)}>
                      <Pencil />
                    </Button>
                    {puedeEliminar && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Eliminar"
                        onClick={() => confirm("¿Eliminar esta plantilla?") && del.mutate(p.id)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </header>
                <div className="p-5">
                  <div className="mb-3 flex gap-2 text-xs">
                    <Badge variant="outline">
                      <ListChecks /> {tareas.length} tareas
                    </Badge>
                    <Badge variant="outline">
                      <CalendarDays /> {eventos.length} eventos
                    </Badge>
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {items.slice(0, 6).map((it) => (
                      <li key={it.id} className="flex items-center gap-2 text-muted-foreground">
                        {it.tipo === "evento" ? (
                          <CalendarDays className="size-3.5 shrink-0 text-primary" />
                        ) : (
                          <ListChecks className="size-3.5 shrink-0 text-primary" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{it.titulo}</span>
                        <span className="shrink-0 text-xs">
                          {it.tipo === "evento"
                            ? `día ${it.dias} · ${labelOf(TIPOS_EVENTO, it.tipo_evento)}`
                            : `${it.dias} días ${it.dias_habiles ? "hábiles" : "calendario"}`}
                        </span>
                      </li>
                    ))}
                    {items.length > 6 && (
                      <li className="text-xs text-muted-foreground">…y {items.length - 6} más</li>
                    )}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {modal && <PlantillaForm open onOpenChange={(o) => !o && setModal(false)} />}
      {edit && <PlantillaForm open plantilla={edit} onOpenChange={(o) => !o && setEdit(null)} />}
    </>
  );
}
