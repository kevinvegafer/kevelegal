import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MailPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { auditoriaQuery, invitacionesQuery, miembrosQuery, nombreMiembro, type Rol } from "@/lib/queries";
import { mensajeError } from "@/lib/errors";
import { useEstudio } from "@/hooks/use-estudio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, PageHeader, Panel, formValues, type FormVals } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/_estudio/equipo")({
  head: () => ({
    meta: [
      { title: "Equipo — Kevelegal" },
      { name: "description", content: "Abogados, asistentes, roles e historial de actividad del estudio." },
      { property: "og:title", content: "Equipo — Kevelegal" },
      { property: "og:description", content: "Equipo del estudio jurídico." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(miembrosQuery(context.estudio.id)),
  component: EquipoPage,
});

const ROLES: { value: Rol; label: string; d: string }[] = [
  { value: "admin", label: "Administrador", d: "Todo, incluido equipo, configuración y auditoría" },
  { value: "abogado", label: "Abogado", d: "Clientes, expedientes, finanzas; puede eliminar" },
  { value: "asistente", label: "Asistente", d: "Clientes, expedientes y agenda; no ve honorarios ni elimina" },
];

const TABLA_LABEL: Record<string, string> = {
  clientes: "cliente",
  expedientes: "expediente",
  partes_procesales: "parte procesal",
  actuaciones: "actuación",
  plazos: "plazo",
  eventos: "evento",
  honorarios: "honorario",
  pagos: "pago",
  gastos: "gasto",
  documentos: "documento",
};
const ACCION_LABEL: Record<string, string> = { insert: "creó", update: "editó", delete: "eliminó" };

function EquipoPage() {
  const { estudioId, esAdmin, user } = useEstudio();
  const qc = useQueryClient();
  const { data: miembros } = useSuspenseQuery(miembrosQuery(estudioId));
  const { data: invitaciones = [] } = useQuery({ ...invitacionesQuery(estudioId), enabled: esAdmin });
  const { data: auditoria = [] } = useQuery({ ...auditoriaQuery(estudioId), enabled: esAdmin });
  const [formKey, setFormKey] = useState(0);

  const invitar = useMutation({
    mutationFn: async (v: FormVals) => {
      if (!v.email) throw new Error("Ingrese el correo");
      const { error } = await supabase.from("invitaciones").insert({
        estudio_id: estudioId,
        email: v.email.toLowerCase(),
        rol: (v.rol ?? "abogado") as Rol,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitaciones", estudioId] });
      toast.success("Invitación creada. Pídale que se registre con ese correo.");
      setFormKey((k) => k + 1);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  const cambiarRol = useMutation({
    mutationFn: async ({ id, rol }: { id: string; rol: Rol }) => {
      const { error } = await supabase.from("estudio_miembros").update({ rol }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["miembros", estudioId] });
      toast.success("Rol actualizado");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  const quitar = useMutation({
    mutationFn: async ({ table, id }: { table: "estudio_miembros" | "invitaciones"; id: string }) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["miembros", estudioId] });
      qc.invalidateQueries({ queryKey: ["invitaciones", estudioId] });
      toast.success("Eliminado");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  const admins = miembros.filter((m) => m.rol === "admin").length;

  return (
    <>
      <PageHeader title="Equipo" description={`${miembros.length} ${miembros.length === 1 ? "miembro" : "miembros"}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Miembros">
          <ul className="divide-y divide-border">
            {miembros.map((m) => {
              const yo = m.user_id === user.id;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid size-9 place-items-center rounded-full bg-accent font-display text-accent-foreground">
                    {(m.perfil?.nombre_completo || m.perfil?.email || "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {m.perfil?.nombre_completo || "Sin nombre"} {yo && <Badge variant="muted">Usted</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.perfil?.email}
                      {m.perfil?.colegiatura && ` · Reg. ${m.perfil.colegiatura}`}
                    </p>
                  </div>
                  {esAdmin && !(yo && admins === 1) ? (
                    <NativeSelect
                      value={m.rol}
                      onChange={(e) => cambiarRol.mutate({ id: m.id, rol: e.target.value as Rol })}
                      className="h-8 w-auto text-xs"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <Badge variant={m.rol === "admin" ? "primary" : "outline"}>{ROLES.find((r) => r.value === m.rol)?.label}</Badge>
                  )}
                  {esAdmin && !yo && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Quitar del estudio"
                      onClick={() => confirm("¿Quitar a este miembro del estudio?") && quitar.mutate({ table: "estudio_miembros", id: m.id })}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="grid content-start gap-6">
          {esAdmin ? (
            <Panel title="Invitar al equipo">
              <form
                key={formKey}
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  invitar.mutate(formValues(e.currentTarget));
                }}
              >
                <Input name="email" type="email" required placeholder="correo@estudio.pe" />
                <NativeSelect name="rol" defaultValue="abogado">
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </NativeSelect>
                <Button type="submit" variant="hero" disabled={invitar.isPending}>
                  <MailPlus /> Crear invitación
                </Button>
                <p className="text-xs text-muted-foreground">
                  La persona debe crear su cuenta en Kevelegal con este mismo correo; verá la invitación al ingresar.
                </p>
              </form>
              {invitaciones.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                  {invitaciones.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {i.email}
                        <span className="block text-xs text-muted-foreground">
                          {ROLES.find((r) => r.value === i.rol)?.label} · {i.aceptada_at ? "Aceptada" : "Pendiente"}
                        </span>
                      </span>
                      {!i.aceptada_at && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Cancelar invitación"
                          onClick={() => quitar.mutate({ table: "invitaciones", id: i.id })}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
          <Panel title="Roles">
            <ul className="space-y-3 text-sm">
              {ROLES.map((r) => (
                <li key={r.value}>
                  <p className="font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.d}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {esAdmin && (
          <Panel className="lg:col-span-3" title="Historial de actividad">
            {auditoria.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay actividad registrada.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {auditoria.map((a) => (
                  <li key={a.id} className="flex flex-wrap gap-x-2 py-2">
                    <span className="w-36 shrink-0 text-xs text-muted-foreground">
                      {format(new Date(a.created_at), "d MMM yyyy HH:mm", { locale: es })}
                    </span>
                    <span>
                      <strong className="font-medium">{nombreMiembro(miembros, a.user_id)}</strong>{" "}
                      {ACCION_LABEL[a.accion] ?? a.accion} {TABLA_LABEL[a.tabla] ?? a.tabla}
                      {a.resumen && <span className="text-muted-foreground"> · {a.resumen}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </>
  );
}
