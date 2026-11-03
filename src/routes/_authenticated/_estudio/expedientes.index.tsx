import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bookmark, FolderKanban, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { mensajeError } from "@/lib/errors";
import { vistasGuardadasQuery, leerFiltrosExpedientes, type FiltrosExpedientes } from "@/lib/vistas";
import { expedientesQuery, miembrosQuery, nombreCliente, nombreMiembro } from "@/lib/queries";
import { ESTADOS_EXPEDIENTE, MATERIAS, labelOf } from "@/lib/peru";
import { useEstudio } from "@/hooks/use-estudio";
import { varianteExpediente } from "@/lib/estados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, NativeSelect, PageHeader } from "@/components/app/ui";
import { ExpedienteForm } from "@/components/forms/ExpedienteForm";

export const Route = createFileRoute("/_authenticated/_estudio/expedientes/")({
  head: () => ({
    meta: [
      { title: "Expedientes — Kevelegal" },
      { name: "description", content: "Expedientes judiciales, fiscales, administrativos y arbitrales del estudio." },
      { property: "og:title", content: "Expedientes — Kevelegal" },
      { property: "og:description", content: "Gestión de expedientes del estudio." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(expedientesQuery(context.estudio.id)),
  component: ExpedientesPage,
});

function ExpedientesPage() {
  const { estudioId, user } = useEstudio();
  const navigate = useNavigate();
  const { data: expedientes } = useSuspenseQuery(expedientesQuery(estudioId));
  const { data: miembros = [] } = useQuery(miembrosQuery(estudioId));
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("en_tramite");
  const [materia, setMateria] = useState("");
  const [mios, setMios] = useState(false);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: vistas = [] } = useQuery(vistasGuardadasQuery(estudioId, "expedientes"));
  const actuales: FiltrosExpedientes = { q, estado, materia, mios };

  function aplicar(f: FiltrosExpedientes) {
    setQ(f.q);
    setEstado(f.estado);
    setMateria(f.materia);
    setMios(f.mios);
  }

  const guardar = useMutation({
    mutationFn: async ({ nombre, compartida }: { nombre: string; compartida: boolean }) => {
      const { error } = await supabase.from("vistas_guardadas").insert({
        estudio_id: estudioId,
        user_id: user.id,
        modulo: "expedientes",
        nombre,
        compartida,
        filtros: actuales,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vistas"] });
      toast.success("Vista guardada");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });
  const borrar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vistas_guardadas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vistas"] }),
    onError: (e) => toast.error(mensajeError(e)),
  });

  const filtrados = expedientes.filter((e) => {
    const texto = `${e.titulo} ${e.numero_expediente ?? ""} ${nombreCliente(e.cliente)} ${e.organo_jurisdiccional ?? ""} ${e.juez ?? ""}`.toLowerCase();
    return (
      (!q || texto.includes(q.toLowerCase())) &&
      (!estado || e.estado === estado) &&
      (!materia || e.materia === materia) &&
      (!mios || e.responsable_id === user.id)
    );
  });

  return (
    <>
      <PageHeader
        title="Expedientes"
        description={`${expedientes.length} en total`}
        actions={
          <Button variant="hero" onClick={() => setOpen(true)}>
            <Plus /> Nuevo expediente
          </Button>
        }
      />

      {expedientes.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Aún no hay expedientes"
          description="Registre su primer caso con el número del Poder Judicial, órgano jurisdiccional y partes."
          action={
            <Button variant="hero" onClick={() => setOpen(true)}>
              <Plus /> Nuevo expediente
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative min-w-60 flex-1">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número, carátula, cliente, juzgado, juez…" className="pl-9" />
            </div>
            <NativeSelect value={estado} onChange={(e) => setEstado(e.target.value)} className="w-auto">
              <option value="">Todos los estados</option>
              {ESTADOS_EXPEDIENTE.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={materia} onChange={(e) => setMateria(e.target.value)} className="w-auto">
              <option value="">Todas las materias</option>
              {MATERIAS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </NativeSelect>
            <Button variant={mios ? "subtle" : "outline"} onClick={() => setMios(!mios)}>
              Solo míos
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const nombre = prompt("Nombre de la vista (ej. Laborales en trámite)")?.trim();
                if (!nombre) return;
                const compartida = confirm("¿Compartir esta vista con todo el estudio? (Cancelar = solo para usted)");
                guardar.mutate({ nombre, compartida });
              }}
            >
              <Bookmark /> Guardar vista
            </Button>
          </div>
          {vistas.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Vistas guardadas:</span>
              {vistas.map((v) => (
                <span key={v.id} className="group inline-flex items-center rounded-full border border-border bg-card text-xs">
                  <button className="px-3 py-1 hover:text-primary" onClick={() => aplicar(leerFiltrosExpedientes(v.filtros))}>
                    {v.nombre}
                    {v.compartida && <span className="ml-1 text-muted-foreground">· compartida</span>}
                  </button>
                  {v.user_id === user.id && (
                    <button
                      aria-label={`Eliminar vista ${v.nombre}`}
                      className="pr-2 text-muted-foreground hover:text-destructive"
                      onClick={() => confirm(`¿Eliminar la vista "${v.nombre}"?`) && borrar.mutate(v.id)}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Expediente</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Órgano</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Responsable</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtrados.map((e) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer transition-colors hover:bg-accent/40"
                    onClick={() => navigate({ to: "/expedientes/$id", params: { id: e.id } })}
                  >
                    <td className="px-4 py-3">
                      <Link to="/expedientes/$id" params={{ id: e.id }} className="font-medium">
                        {e.titulo}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">
                        {e.numero_expediente || "Sin número"} · {labelOf(MATERIAS, e.materia)}
                      </p>
                    </td>
                    <td className="px-4 py-3">{nombreCliente(e.cliente)}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {e.organo_jurisdiccional || "—"}
                      {e.distrito_judicial && <span className="block text-xs">CSJ {e.distrito_judicial}</span>}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {nombreMiembro(miembros, e.responsable_id)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={varianteExpediente(e.estado)}>
                        {labelOf(ESTADOS_EXPEDIENTE, e.estado)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtrados.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">Ningún expediente coincide con los filtros.</p>
            )}
          </div>
        </>
      )}

      {open && (
        <ExpedienteForm
          open
          onOpenChange={setOpen}
          onSaved={(id) => navigate({ to: "/expedientes/$id", params: { id } })}
        />
      )}
    </>
  );
}
