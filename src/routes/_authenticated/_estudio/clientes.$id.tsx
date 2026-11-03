import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, FolderKanban, Mail, MapPin, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { clienteQuery, expedientesQuery, honorariosQuery, nombreCliente } from "@/lib/queries";
import { formatSoles, labelOf, MATERIAS, ESTADOS_EXPEDIENTE } from "@/lib/peru";
import { mensajeError } from "@/lib/errors";
import { useEstudio } from "@/hooks/use-estudio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Panel } from "@/components/app/ui";
import { ClienteForm } from "@/components/forms/ClienteForm";
import { ExpedienteForm } from "@/components/forms/ExpedienteForm";
import { HonorarioForm } from "@/components/forms/FinanzasForms";
import { MensajesCliente, PortalClientePanel } from "@/components/app/PortalCliente";

export const Route = createFileRoute("/_authenticated/_estudio/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Ficha de cliente — Kevelegal" },
      { name: "description", content: "Datos, expedientes y honorarios del cliente." },
      { property: "og:title", content: "Ficha de cliente — Kevelegal" },
      { property: "og:description", content: "Ficha de cliente en Kevelegal." },
    ],
  }),
  loader: async ({ context, params }) => {
    const c = await context.queryClient.ensureQueryData(clienteQuery(params.id));
    if (!c) throw notFound();
    await context.queryClient.ensureQueryData(expedientesQuery(context.estudio.id));
  },
  component: ClienteDetalle,
});

function ClienteDetalle() {
  const { id } = Route.useParams();
  const { estudioId, puedeVerFinanzas, puedeEliminar } = useEstudio();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: cliente } = useSuspenseQuery(clienteQuery(id));
  const { data: expedientes } = useSuspenseQuery(expedientesQuery(estudioId));
  const { data: honorarios = [] } = useQuery({ ...honorariosQuery(estudioId), enabled: puedeVerFinanzas });
  const [modal, setModal] = useState<null | "editar" | "expediente" | "honorario">(null);

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente eliminado");
      navigate({ to: "/clientes" });
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  if (!cliente) return null;
  const suyos = expedientes.filter((e) => e.cliente_id === id);
  const susHonorarios = honorarios.filter((h) => h.cliente_id === id);
  const totalPactado = susHonorarios.filter((h) => h.moneda === "PEN").reduce((s, h) => s + Number(h.monto_total), 0);
  const totalPagado = susHonorarios
    .filter((h) => h.moneda === "PEN")
    .flatMap((h) => h.pagos)
    .reduce((s, p) => s + Number(p.monto), 0);

  return (
    <>
      <Link to="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-primary">
            {cliente.tipo_persona === "juridica" ? "Persona jurídica" : "Persona natural"}
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{nombreCliente(cliente)}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {cliente.tipo_documento} {cliente.numero_documento}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModal("editar")}>
            <Pencil /> Editar
          </Button>
          {puedeEliminar && (
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm("¿Eliminar este cliente? Sus expedientes quedarán sin cliente asignado.")) del.mutate();
              }}
            >
              <Trash2 /> Eliminar
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Datos de contacto">
          <dl className="space-y-3 text-sm">
            <Row icon={Phone} value={cliente.telefono} />
            <Row icon={Mail} value={cliente.email} />
            <Row
              icon={MapPin}
              value={[cliente.direccion, cliente.distrito, cliente.provincia, cliente.departamento].filter(Boolean).join(", ")}
            />
            {cliente.representante_legal && (
              <div>
                <dt className="text-xs text-muted-foreground">Representante legal</dt>
                <dd>{cliente.representante_legal}</dd>
              </div>
            )}
            {cliente.origen && (
              <div>
                <dt className="text-xs text-muted-foreground">Origen</dt>
                <dd>{cliente.origen}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted-foreground">Estado</dt>
              <dd className="capitalize">{cliente.estado}</dd>
            </div>
            {cliente.notas && (
              <div>
                <dt className="text-xs text-muted-foreground">Notas</dt>
                <dd className="whitespace-pre-wrap">{cliente.notas}</dd>
              </div>
            )}
          </dl>
        </Panel>

        <Panel
          className="lg:col-span-2"
          title={`Expedientes (${suyos.length})`}
          action={
            <Button size="sm" variant="subtle" onClick={() => setModal("expediente")}>
              <Plus /> Expediente
            </Button>
          }
        >
          {suyos.length === 0 ? (
            <EmptyState icon={FolderKanban} title="Sin expedientes" description="Abra un expediente para este cliente." />
          ) : (
            <ul className="divide-y divide-border">
              {suyos.map((e) => (
                <li key={e.id}>
                  <Link to="/expedientes/$id" params={{ id: e.id }} className="flex items-center gap-3 py-3 hover:text-primary">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {labelOf(MATERIAS, e.materia)} · <span className="font-mono">{e.numero_expediente || "Sin número"}</span>
                      </p>
                    </div>
                    <Badge variant={e.estado === "en_tramite" ? "primary" : "muted"}>{labelOf(ESTADOS_EXPEDIENTE, e.estado)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {puedeVerFinanzas && (
          <Panel
            className="lg:col-span-3"
            title="Honorarios"
            action={
              <Button size="sm" variant="subtle" onClick={() => setModal("honorario")}>
                <Plus /> Acuerdo
              </Button>
            }
          >
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <Mini label="Pactado (S/)" value={formatSoles(totalPactado)} />
              <Mini label="Pagado" value={formatSoles(totalPagado)} />
              <Mini label="Saldo" value={formatSoles(totalPactado - totalPagado)} accent />
            </div>
            {susHonorarios.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin acuerdos de honorarios.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {susHonorarios.map((h) => {
                  const pagado = h.pagos.reduce((s, p) => s + Number(p.monto), 0);
                  return (
                    <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span>{h.concepto}</span>
                      <span className="text-muted-foreground">
                        {formatSoles(pagado, h.moneda)} / {formatSoles(h.monto_total, h.moneda)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}
      </div>

      <section className="mt-8 space-y-6" aria-labelledby="portal-mensajes">
        <h2 id="portal-mensajes" className="font-display text-2xl">
          Portal y mensajes
        </h2>
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <PortalClientePanel clienteId={id} />
          <MensajesCliente clienteId={id} />
        </div>
      </section>

      {modal === "editar" && <ClienteForm open cliente={cliente} onOpenChange={(o) => !o && setModal(null)} />}
      {modal === "expediente" && (
        <ExpedienteForm
          open
          clienteId={id}
          onOpenChange={(o) => !o && setModal(null)}
          onSaved={(eid) => navigate({ to: "/expedientes/$id", params: { id: eid } })}
        />
      )}
      {modal === "honorario" && <HonorarioForm open clienteId={id} onOpenChange={(o) => !o && setModal(null)} />}
    </>
  );
}

function Row({ icon: Icon, value }: { icon: React.ComponentType<{ className?: string }>; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 text-muted-foreground" />
      <span className={value ? "" : "text-muted-foreground"}>{value || "—"}</span>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={accent ? "mt-1 font-display text-xl text-primary" : "mt-1 font-display text-xl"}>{value}</p>
    </div>
  );
}
