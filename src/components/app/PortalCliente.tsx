import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/demo-db/client";
import { useEstudio } from "@/hooks/use-estudio";
import { clienteQuery, type Documento } from "@/lib/queries";
import { portalAccesosQuery, mensajesClienteQuery } from "@/lib/queries-portal";
import { mensajeError } from "@/lib/errors";
import { Panel, NativeSelect } from "@/components/app/ui";
import { Button } from "@/components/ui/button";

function fecha(value: string | null) {
  return value
    ? new Date(value).toLocaleString("es-PE", { timeZone: "America/Lima" })
    : "Nunca";
}

function telefonoPeru(value: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (/^9\d{8}$/.test(digits)) return `51${digits}`;
  if (/^519\d{8}$/.test(digits)) return digits;
  return null;
}

export function PortalClientePanel({ clienteId }: { clienteId: string }) {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  const accesos = useQuery(portalAccesosQuery(estudioId, clienteId));
  const cliente = useQuery(clienteQuery(clienteId));
  const [dias, setDias] = useState("30");

  const cambiar = useMutation({
    mutationFn: async (id: string | null) => {
      if (id) {
        const result = await supabase.from("portal_accesos")
          .update({ activo: false })
          .eq("id", id)
          .eq("cliente_id", clienteId)
          .eq("estudio_id", estudioId);
        if (result.error) throw result.error;
      } else {
        const result = await supabase.from("portal_accesos").insert({
          estudio_id: estudioId,
          cliente_id: clienteId,
          expira_at: dias === "0"
            ? null
            : new Date(Date.now() + Number(dias) * 86400000).toISOString(),
        });
        if (result.error) throw result.error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["portal-accesos", estudioId, clienteId],
      });
      toast.success("Acceso actualizado");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  const enlace = (token: string) => `${window.location.origin}/portal/${token}`;
  const texto = (token: string) =>
    `Acceda a su portal privado del estudio: ${enlace(token)}. No comparta este enlace.`;

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(enlace(token));
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  const telefono = telefonoPeru(cliente.data?.telefono ?? null);

  return (
    <Panel title="Portal del cliente">
      <p className="mb-4 text-sm text-muted-foreground">
        Cada enlace permite acceder a información privada del cliente.
        Compártalo únicamente con su titular.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <NativeSelect aria-label="Vencimiento del enlace"
          className="w-auto" value={dias}
          onChange={(e) => setDias(e.target.value)}>
          <option value="30">30 días</option>
          <option value="90">90 días</option>
          <option value="0">Sin vencimiento</option>
        </NativeSelect>
        <Button disabled={cambiar.isPending} onClick={() => cambiar.mutate(null)}>
          Crear enlace
        </Button>
      </div>
      {accesos.isPending && <p role="status">Cargando accesos…</p>}
      {accesos.isError && <p role="alert">{mensajeError(accesos.error)}</p>}
      {accesos.data?.length === 0 && <p className="text-sm text-muted-foreground">Sin accesos creados.</p>}
      <ul className="divide-y divide-border">
        {accesos.data?.map((a) => {
          const vencido = !!a.expira_at && new Date(a.expira_at) <= new Date();
          const util = a.activo && !vencido;
          return (
            <li key={a.id} className="space-y-2 py-4">
              <p className="text-sm font-medium">
                {!a.activo ? "Desactivado" : vencido ? "Vencido" : "Activo"}
                {" · "}{a.expira_at ? `Vence: ${fecha(a.expira_at)}` : "Sin vencimiento"}
              </p>
              <p className="text-xs text-muted-foreground">
                Último acceso: {fecha(a.ultimo_acceso)}
              </p>
              {util && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void copiar(a.token)}>
                    Copiar enlace
                  </Button>
                  {telefono && (
                    <Button size="sm" variant="outline" onClick={() => {
                      window.open(
                        `https://wa.me/${telefono}?text=${encodeURIComponent(texto(a.token))}`,
                        "_blank", "noopener,noreferrer",
                      );
                    }}>WhatsApp</Button>
                  )}
                  {cliente.data?.email && (
                    <Button size="sm" variant="outline" onClick={() => {
                      window.location.href =
                        `mailto:${encodeURIComponent(cliente.data?.email ?? "")}` +
                        `?subject=${encodeURIComponent("Su portal del cliente")}` +
                        `&body=${encodeURIComponent(texto(a.token))}`;
                    }}>Correo</Button>
                  )}
                </div>
              )}
              {a.activo && (
                <Button size="sm" variant="ghost" disabled={cambiar.isPending}
                  onClick={() => {
                    if (window.confirm("¿Desactivar este enlace de acceso?")) {
                      cambiar.mutate(a.id);
                    }
                  }}>
                  Desactivar
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function MensajesCliente({ clienteId }: { clienteId: string }) {
  const { estudioId, user } = useEstudio();
  const qc = useQueryClient();
  const query = useQuery(mensajesClienteQuery(estudioId, clienteId));
  const [cuerpo, setCuerpo] = useState("");
  const marcando = useRef(false);
  const noLeidos = (query.data ?? [])
    .filter((m) => m.autor === "cliente" && !m.leido_at);

  const ids = noLeidos.map((m) => m.id).join(",");

  useEffect(() => {
    if (!ids || marcando.current || document.visibilityState !== "visible") return;
    marcando.current = true;
    void (async () => {
      const result = await supabase.from("mensajes_cliente")
        .update({ leido_at: new Date().toISOString() })
        .eq("estudio_id", estudioId)
        .eq("cliente_id", clienteId)
        .eq("autor", "cliente")
        .is("leido_at", null)
        .in("id", ids.split(","));
      marcando.current = false;
      if (result.error) toast.error(mensajeError(result.error));
      else void qc.invalidateQueries({ queryKey: ["mensajes-cliente", estudioId] });
    })();
  }, [ids, estudioId, clienteId, qc]);

  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("mensajes_cliente").insert({
        estudio_id: estudioId,
        cliente_id: clienteId,
        autor: "estudio",
        autor_id: user.id,
        cuerpo: cuerpo.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCuerpo("");
      void qc.invalidateQueries({ queryKey: ["mensajes-cliente", estudioId] });
      toast.success("Mensaje enviado al portal");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  return (
    <Panel title={`Mensajes del cliente (${noLeidos.length} sin leer)`}>
      {query.isPending && <p role="status">Cargando mensajes…</p>}
      {query.isError && <p role="alert">{mensajeError(query.error)}</p>}
      <div className="max-h-96 space-y-3 overflow-y-auto" role="log"
        aria-label="Mensajes del cliente">
        {query.data?.length === 0 && <p className="text-sm text-muted-foreground">Sin mensajes.</p>}
        {query.data?.map((m) => (
          <article key={m.id}
            className={`rounded-md border border-border p-3 ${
              m.autor === "estudio" ? "ml-4 bg-accent" : "mr-4 bg-card"
            }`}>
            <p className="text-xs text-muted-foreground">
              {m.autor === "estudio" ? "Estudio" : "Cliente"}
              {" · "}{fecha(m.created_at)}
              {m.masivo && " · Mensaje masivo"}
              {m.autor === "estudio" && m.leido_at && " · Leído"}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.cuerpo}</p>
          </article>
        ))}
      </div>
      <form className="mt-4 space-y-3" onSubmit={(e) => {
        e.preventDefault();
        if (cuerpo.trim()) enviar.mutate();
      }}>
        <label className="block text-sm">
          Mensaje para el cliente
          <textarea required maxLength={5000} rows={4} value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background p-3" />
        </label>
        <Button disabled={enviar.isPending || !cuerpo.trim()}>
          {enviar.isPending ? "Enviando…" : "Enviar al portal"}
        </Button>
      </form>
    </Panel>
  );
}

export function ToggleVisibleCliente({
  documento,
}: {
  documento: Pick<Documento,
    "id" | "estudio_id" | "expediente_id" | "visible_cliente" | "subido_por_cliente"
  >;
}) {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      if (documento.estudio_id !== estudioId) throw new Error("Documento no disponible");
      const { error } = await supabase.from("documentos")
        .update({ visible_cliente: !documento.visible_cliente })
        .eq("id", documento.id)
        .eq("estudio_id", estudioId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["documentos", documento.expediente_id],
      });
      toast.success("Visibilidad actualizada");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  // Los documentos del cliente siempre son visibles según el RPC.
  if (documento.subido_por_cliente) {
    return <span className="text-xs text-muted-foreground">Enviado por el cliente</span>;
  }

  return (
    <Button size="sm" variant="outline" disabled={mutation.isPending}
      aria-pressed={documento.visible_cliente}
      onClick={() => mutation.mutate()}>
      {documento.visible_cliente ? "Ocultar del portal" : "Compartir en portal"}
    </Button>
  );
}
