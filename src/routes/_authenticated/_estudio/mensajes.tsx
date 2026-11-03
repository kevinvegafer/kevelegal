import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEstudio } from "@/hooks/use-estudio";
import { clientesQuery, expedientesQuery, nombreCliente } from "@/lib/queries";
import { mensajesClienteQuery } from "@/lib/queries-portal";
import { mensajeError } from "@/lib/errors";
import { labelOf, MATERIAS } from "@/lib/peru";
import { PageHeader, Panel, NativeSelect } from "@/components/app/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_estudio/mensajes")({
  head: () => ({
    meta: [
      { title: "Mensajes de clientes — Kevelegal" },
      { name: "description", content: "Bandeja de clientes y comunicaciones masivas del estudio." },
      { property: "og:title", content: "Mensajes de clientes — Kevelegal" },
      { property: "og:description", content: "Gestione conversaciones y mensajes masivos a sus clientes." },
    ],
  }),
  component: Mensajes,
});

type Envio = {
  emails: string[];
  cuerpo: string;
  cantidad: number;
};

function Mensajes() {
  const { estudioId, user } = useEstudio();
  const qc = useQueryClient();
  const clientes = useQuery(clientesQuery(estudioId));
  const expedientes = useQuery(expedientesQuery(estudioId));
  const mensajes = useQuery(mensajesClienteQuery(estudioId));
  const [modo, setModo] = useState("activos");
  const [estado, setEstado] = useState("");
  const [materia, setMateria] = useState("");
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [cuerpo, setCuerpo] = useState("");
  const [enviado, setEnviado] = useState<Envio | null>(null);

  const estados = [...new Set((clientes.data ?? []).map((c) => c.estado))].sort();
  const materias = [...new Set((expedientes.data ?? []).map((e) => e.materia))].sort();

  const destinatarios = useMemo(() => {
    const idsMateria = new Set((expedientes.data ?? [])
      .filter((e) => e.materia === materia)
      .map((e) => e.cliente_id));
    return (clientes.data ?? []).filter((c) => {
      if (modo === "activos") return c.estado === "activo";
      if (modo === "estado") return !!estado && c.estado === estado;
      if (modo === "materia") return !!materia && idsMateria.has(c.id);
      return seleccion.includes(c.id);
    });
  }, [clientes.data, expedientes.data, modo, estado, materia, seleccion]);

  const bandeja = useMemo(() => {
    const grupos = new Map<string, {
      clienteId: string;
      cuerpo: string;
      fecha: string;
      sinLeer: number;
    }>();
    for (const m of mensajes.data ?? []) {
      if (m.autor !== "cliente") continue;
      const previo = grupos.get(m.cliente_id);
      grupos.set(m.cliente_id, {
        clienteId: m.cliente_id,
        cuerpo: m.cuerpo,
        fecha: m.created_at,
        sinLeer: (previo?.sinLeer ?? 0) + (m.leido_at ? 0 : 1),
      });
    }
    return [...grupos.values()].sort((a, b) =>
      Number(b.sinLeer > 0) - Number(a.sinLeer > 0) ||
      b.fecha.localeCompare(a.fecha));
  }, [mensajes.data]);

  const enviar = useMutation({
    mutationFn: async () => {
      const texto = cuerpo.trim();
      if (!texto || texto.length > 5000 || !destinatarios.length) {
        throw new Error("Seleccione destinatarios y escriba un mensaje de hasta 5000 caracteres");
      }
      const snapshot = [...destinatarios];
      const { error } = await supabase.from("mensajes_cliente").insert(
        snapshot.map((c) => ({
          estudio_id: estudioId,
          cliente_id: c.id,
          autor: "estudio",
          autor_id: user.id,
          cuerpo: texto,
          masivo: true,
        })),
      );
      if (error) throw error;

      return {
        cantidad: snapshot.length,
        cuerpo: texto,
        emails: [...new Set(snapshot
          .map((c) => c.email?.trim())
          .filter((email): email is string =>
            !!email && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)))],
      };
    },
    onSuccess: (result) => {
      setEnviado(result);
      setCuerpo("");
      void qc.invalidateQueries({ queryKey: ["mensajes-cliente", estudioId] });
      toast.success(`Mensaje enviado a ${result.cantidad} clientes`);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  const error = clientes.error ?? expedientes.error ?? mensajes.error;
  const pendiente = clientes.isPending || expedientes.isPending || mensajes.isPending;
  const mailto = enviado
    ? `mailto:?bcc=${encodeURIComponent(enviado.emails.join(","))}` +
      `&subject=${encodeURIComponent("Comunicación de su estudio jurídico")}` +
      `&body=${encodeURIComponent(enviado.cuerpo)}`
    : "";

  return (
    <>
      <PageHeader title="Mensajes"
        description="Conversaciones de clientes y comunicaciones en sus portales." />
      {error && <p role="alert" className="mb-4 text-destructive">{mensajeError(error)}</p>}
      {pendiente && <p role="status">Cargando clientes y mensajes…</p>}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Bandeja de clientes">
          {!pendiente && !bandeja.length && (
            <p className="text-sm text-muted-foreground">Todavía no hay mensajes de clientes.</p>
          )}
          <ul className="divide-y divide-border">
            {bandeja.map((item) => (
              <li key={item.clienteId}>
                <Link to="/clientes/$id" params={{ id: item.clienteId }}
                  className="block space-y-2 rounded-md py-4 hover:bg-accent">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {nombreCliente(clientes.data?.find((c) => c.id === item.clienteId))}
                    </span>
                    {item.sinLeer > 0 && (
                      <span className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-primary">
                        {item.sinLeer} sin leer
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 break-words text-sm text-muted-foreground">{item.cuerpo}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.fecha).toLocaleString("es-PE", {
                      timeZone: "America/Lima",
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Mensaje masivo">
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (window.confirm(`¿Enviar este mensaje a ${destinatarios.length} clientes?`)) {
              enviar.mutate();
            }
          }}>
            <label className="block text-sm">
              Destinatarios
              <NativeSelect value={modo} disabled={enviar.isPending}
                onChange={(e) => setModo(e.target.value)}>
                <option value="activos">Todos los clientes activos</option>
                <option value="estado">Por estado del cliente</option>
                <option value="materia">Por materia de sus expedientes</option>
                <option value="manual">Selección manual</option>
              </NativeSelect>
            </label>

            {modo === "estado" && (
              <label className="block text-sm">
                Estado
                <NativeSelect value={estado} disabled={enviar.isPending}
                  onChange={(e) => setEstado(e.target.value)}>
                  <option value="">Seleccione un estado</option>
                  {estados.map((v) => <option key={v} value={v}>{v}</option>)}
                </NativeSelect>
              </label>
            )}

            {modo === "materia" && (
              <label className="block text-sm">
                Materia
                <NativeSelect value={materia} disabled={enviar.isPending}
                  onChange={(e) => setMateria(e.target.value)}>
                  <option value="">Seleccione una materia</option>
                  {materias.map((v) => (
                    <option key={v} value={v}>{labelOf(MATERIAS, v)}</option>
                  ))}
                </NativeSelect>
              </label>
            )}

            {modo === "manual" && (
              <fieldset className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                <legend className="px-1 text-sm">Seleccione clientes</legend>
                {clientes.data?.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={seleccion.includes(c.id)}
                      disabled={enviar.isPending}
                      onChange={(e) => setSeleccion((prev) =>
                        e.target.checked
                          ? [...prev, c.id]
                          : prev.filter((id) => id !== c.id))} />
                    {nombreCliente(c)}
                  </label>
                ))}
              </fieldset>
            )}

            <details className="rounded-md border border-border p-3 text-sm">
              <summary>{destinatarios.length} destinatarios · Revisar lista</summary>
              <ul className="mt-2 max-h-48 overflow-y-auto">
                {destinatarios.map((c) => <li key={c.id}>{nombreCliente(c)}</li>)}
              </ul>
            </details>

            <label className="block text-sm">
              Mensaje
              <textarea required rows={6} maxLength={5000}
                value={cuerpo} disabled={enviar.isPending}
                onChange={(e) => setCuerpo(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background p-3" />
            </label>
            <p className="text-xs text-muted-foreground">
              El mensaje aparecerá en el portal de cada cliente.
              No se enviarán correos ni mensajes de WhatsApp automáticamente.
            </p>
            <Button disabled={pendiente || !!error || enviar.isPending ||
              !destinatarios.length || !cuerpo.trim()}>
              {enviar.isPending ? "Enviando…" : "Enviar mensaje masivo"}
            </Button>
          </form>

          {enviado && (
            <section className="mt-6 space-y-3 rounded-md border border-border bg-accent p-4"
              aria-label="Resultado del envío">
              <h3 className="font-medium">
                Publicado en {enviado.cantidad} portales
              </h3>
              <p className="text-sm text-muted-foreground">
                {enviado.emails.length} destinatarios tienen un correo válido.
                Puede preparar un correo adicional usando CCO para proteger sus direcciones.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={!enviado.emails.length}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(enviado.emails.join("; "));
                      toast.success("Correos copiados para CCO");
                    } catch {
                      toast.error("No se pudieron copiar los correos");
                    }
                  }}>Copiar correos (CCO)</Button>
                {enviado.emails.length > 0 && mailto.length <= 1800 && (
                  <a href={mailto} className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm">
                    Preparar correo con CCO
                  </a>
                )}
              </div>
              {mailto.length > 1800 && (
                <p className="text-xs text-muted-foreground">
                  La lista es demasiado larga para un enlace de correo fiable.
                  Copie los correos en CCO y pegue el mensaje en su aplicación.
                </p>
              )}
            </section>
          )}
        </Panel>
      </div>
    </>
  );
}
