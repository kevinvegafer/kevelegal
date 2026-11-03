import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { portalDatosQuery } from "@/lib/queries-portal";
import {
  portalDescargar,
  portalSubirInicio,
  portalSubirConfirmar,
} from "@/lib/portal.functions";
import { mensajeError } from "@/lib/errors";
import { formatSoles } from "@/lib/peru";
import { Panel, NativeSelect } from "@/components/app/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/portal/$token")({
  head: () => ({
    meta: [
      { title: "Portal del cliente — Kevelegal" },
      { name: "description", content: "Consulte sus expedientes y comuníquese con su estudio jurídico." },
      { property: "og:title", content: "Portal del cliente — Kevelegal" },
      { property: "og:description", content: "Acceso privado a su información legal." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: Portal,
});

function fecha(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function Portal() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const query = useQuery(portalDatosQuery(token));
  const descargar = useServerFn(portalDescargar);
  const inicio = useServerFn(portalSubirInicio);
  const confirmar = useServerFn(portalSubirConfirmar);
  const [cuerpo, setCuerpo] = useState("");
  const [expediente, setExpediente] = useState("");
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);

  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("portal_enviar_mensaje", {
        _token: token,
        // SQL accepts null for a general question; generated types mark it as string
        _expediente: (expediente || null) as string,
        _cuerpo: cuerpo.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCuerpo("");
      void qc.invalidateQueries({ queryKey: ["portal-datos", token] });
      toast.success("Mensaje enviado");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  async function subir(expedienteId: string, file: File) {
    if (!file.size || file.size > 25 * 1024 * 1024) {
      toast.error("Seleccione un archivo de hasta 25 MB");
      return;
    }
    setSubiendo(expedienteId);
    try {
      const metadata = {
        token,
        expedienteId,
        nombre: file.name,
        tamano: file.size,
        mime: file.type || "application/octet-stream",
      };
      const signed = await inicio({ data: metadata });
      const result = await supabase.storage.from("documentos")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: metadata.mime,
        });
      if (result.error) throw result.error;
      const saved = await confirmar({
        data: { ...metadata, path: signed.path },
      });
      toast.success("Documento enviado al estudio");
      if ("avisoPendiente" in saved && saved.avisoPendiente) {
        toast.warning("El documento se guardó, pero no se pudo generar el aviso.");
      }
      await qc.invalidateQueries({ queryKey: ["portal-datos", token] });
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setSubiendo(null);
    }
  }

  async function descargarDocumento(documentoId: string) {
    setDescargando(documentoId);
    try {
      const result = await descargar({ data: { token, documentoId } });
      const anchor = document.createElement("a");
      anchor.href = result.url;
      anchor.rel = "noreferrer";
      anchor.click();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setDescargando(null);
    }
  }

  if (query.isPending) {
    return <main className="mx-auto max-w-4xl p-6" role="status">Cargando su portal…</main>;
  }
  if (query.isError || !query.data) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-8">
        <h1 className="font-display text-2xl">No podemos abrir este portal</h1>
        <p className="text-muted-foreground">
          El enlace puede haber vencido o sido desactivado. Solicite un nuevo
          enlace a su estudio jurídico.
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Volver a intentar
        </Button>
      </main>
    );
  }

  const datos = query.data;
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <header className="border-b border-border pb-6">
          <p className="text-sm font-medium text-primary">{datos.estudio.nombre}</p>
          <h1 className="mt-2 font-display text-3xl">
            Hola, {datos.cliente.nombre}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Su espacio privado para seguir sus asuntos y conversar con el estudio.
            No comparta este enlace.
          </p>
          <p className="mt-2 break-words text-sm text-muted-foreground">
            {[datos.estudio.telefono, datos.estudio.email].filter(Boolean).join(" · ")}
          </p>
        </header>

        <h2 className="font-display text-xl">Sus expedientes</h2>
        {!datos.expedientes.length && <p>No tiene expedientes activos.</p>}

        {datos.expedientes.map((e) => {
          const actual = e.fase ? e.fases.indexOf(e.fase) : -1;
          return (
            <Panel key={e.id} title={e.titulo}>
              <p className="mb-4 text-sm text-muted-foreground">
                {e.numero || "Sin número"} · {e.materia} · {e.estado}
              </p>
              <ol aria-label="Etapas del expediente"
                className="mb-4 flex flex-wrap gap-2">
                {e.fases.map((fase, index) => (
                  <li key={`${fase}-${index}`}
                    aria-current={index === actual ? "step" : undefined}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      index === actual
                        ? "border-primary bg-accent font-semibold text-primary"
                        : "border-border text-muted-foreground"
                    }`}>
                    {index < actual ? "✓ " : `${index + 1}. `}{fase}
                    {index === actual && " · Actual"}
                  </li>
                ))}
              </ol>
              {!e.fase && <p className="text-sm text-muted-foreground">Etapa por definir.</p>}
              {e.fase_desde && (
                <p className="mb-4 text-xs text-muted-foreground">
                  En esta etapa desde {fecha(e.fase_desde)}
                </p>
              )}
              <h3 className="font-medium">Próximas audiencias y eventos</h3>
              {!e.proximos.length && (
                <p className="mt-2 text-sm text-muted-foreground">Sin eventos programados.</p>
              )}
              <ul className="divide-y divide-border">
                {e.proximos.map((evento, index) => (
                  <li key={`${evento.inicio}-${index}`} className="py-3 text-sm">
                    <p className="font-medium">{evento.titulo}</p>
                    <p className="text-muted-foreground">
                      {fecha(evento.inicio)} · {evento.tipo}
                      {evento.modalidad && ` · ${evento.modalidad}`}
                    </p>
                  </li>
                ))}
              </ul>
              <label className="mt-4 block text-sm font-medium">
                Subir documento · máximo 25 MB
                <input type="file"
                  className="mt-2 block w-full rounded-md border border-input p-2 text-sm"
                  disabled={subiendo !== null}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (file) void subir(e.id, file);
                  }}
                />
              </label>
              {subiendo === e.id && <p role="status">Enviando documento…</p>}
            </Panel>
          );
        })}

        <Panel title="Documentos compartidos">
          {!datos.documentos.length && <p className="text-sm text-muted-foreground">Sin documentos compartidos.</p>}
          <ul className="divide-y divide-border">
            {datos.documentos.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{d.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {fecha(d.created_at)}
                    {d.subido_por_cliente && " · Enviado por usted"}
                    {d.tamano !== null && ` · ${(d.tamano / 1024).toFixed(0)} KB`}
                  </p>
                </div>
                <Button variant="outline" size="sm"
                  disabled={descargando !== null}
                  onClick={() => void descargarDocumento(d.id)}>
                  {descargando === d.id ? "Preparando…" : "Descargar"}
                </Button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Estado de cuenta">
          {!datos.cuenta.length && <p className="text-sm text-muted-foreground">Sin acuerdos registrados.</p>}
          <div className="space-y-6">
            {datos.cuenta.map((acuerdo, index) => {
              let acumulado = 0;
              return (
                <section key={index}>
                  <h3 className="font-medium">{acuerdo.concepto}</h3>
                  <dl className="my-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                    {[
                      ["Total", acuerdo.total],
                      ["Pagado", acuerdo.pagado],
                      ["Saldo", Math.max(0, acuerdo.total - acuerdo.pagado)],
                    ].map(([label, monto]) => (
                      <div key={String(label)} className="rounded-md border border-border p-3">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-medium">
                          {formatSoles(Number(monto), acuerdo.moneda)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <ul className="space-y-2 text-sm">
                    {acuerdo.cuotas.map((cuota) => {
                      acumulado += cuota.monto;
                      // El RPC no ofrece imputación individual de pagos.
                      const cubierta = acuerdo.pagado >= acumulado;
                      const vencida = cuota.vence < hoy && !cubierta;
                      return (
                        <li key={cuota.numero}
                          className={`rounded-md border p-3 ${
                            vencida
                              ? "border-destructive text-destructive"
                              : "border-border"
                          }`}>
                          Cuota {cuota.numero} · {formatSoles(cuota.monto, acuerdo.moneda)}
                          {" · Vence "}{cuota.vence}
                          {vencida && " · Vencida"}
                          {cubierta && " · Cubierta"}
                        </li>
                      );
                    })}
                  </ul>
                  {!!acuerdo.cuotas.length && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Estado estimado aplicando los pagos a las cuotas en orden.
                      Confirme la imputación con el estudio.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        </Panel>

        <Panel title="Mensajes con su estudio">
          <div className="max-h-96 space-y-3 overflow-y-auto" role="log"
            aria-label="Conversación con el estudio">
            {!datos.mensajes.length && <p className="text-sm text-muted-foreground">Todavía no hay mensajes.</p>}
            {datos.mensajes.map((m) => (
              <article key={m.id}
                className={`rounded-lg border border-border p-3 ${
                  m.autor === "cliente" ? "ml-4 bg-accent" : "mr-4 bg-card"
                }`}>
                <p className="text-xs font-medium">
                  {m.autor === "cliente" ? "Usted" : datos.estudio.nombre}
                  {" · "}{fecha(m.created_at)}
                </p>
                {m.expediente_id && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {datos.expedientes.find((e) => e.id === m.expediente_id)?.titulo || "Expediente"}
                  </p>
                )}
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.cuerpo}</p>
              </article>
            ))}
          </div>
          <form className="mt-5 space-y-3" onSubmit={(event) => {
            event.preventDefault();
            if (cuerpo.trim()) enviar.mutate();
          }}>
            <label className="block text-sm">
              Sobre
              <NativeSelect value={expediente}
                onChange={(event) => setExpediente(event.target.value)}>
                <option value="">Consulta general</option>
                {datos.expedientes.map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}
              </NativeSelect>
            </label>
            <label className="block text-sm">
              Su mensaje
              <textarea required maxLength={5000} rows={4} value={cuerpo}
                onChange={(event) => setCuerpo(event.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background p-3" />
            </label>
            <Button disabled={enviar.isPending || !cuerpo.trim()}>
              {enviar.isPending ? "Enviando…" : "Enviar mensaje"}
            </Button>
          </form>
        </Panel>
      </div>
    </main>
  );
}
