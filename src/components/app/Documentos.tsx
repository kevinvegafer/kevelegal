import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/demo-db/client";
import { useEstudio } from "@/hooks/use-estudio";
import { documentosQuery } from "@/lib/queries";
import {
  enlacesDocumentoQuery,
  familiaDocumento,
  ultimasVersiones,
  type Documento,
} from "@/lib/documentos.queries";
import { mensajeError } from "@/lib/errors";
import { DocumentUpload } from "@/components/forms/ExpedienteDetalleForms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Panel, NativeSelect } from "@/components/app/ui";
import { ToggleVisibleCliente } from "@/components/app/PortalCliente";
import { IniciarCronometro } from "@/components/app/Cronometros";

function esTexto(d: Documento) {
  return (
    d.mime_type?.startsWith("text/") ||
    /\.(txt|md|csv|json|xml|log)$/i.test(d.nombre)
  );
}

export function DocumentoPreview({
  documento,
  onClose,
}: {
  documento: Documento | null;
  onClose: () => void;
}) {
  const [contenido, setContenido] = useState<{
    id: string;
    url: string;
    texto: string | null;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    setContenido(null);
    setError("");
    if (!documento) return;

    const d = documento;
    void (async () => {
      const { data, error: signedError } = await supabase.storage
        .from("documentos")
        .createSignedUrl(d.storage_path, 300);
      if (signedError) throw signedError;

      let texto: string | null = null;
      if (esTexto(d)) {
        // Avoid rendering enormous text documents in the browser.
        if ((d.tamano ?? 0) > 2 * 1024 * 1024) {
          texto = "Archivo demasiado grande para la vista de texto. Descárguelo.";
        } else {
          const result = await supabase.storage
            .from("documentos")
            .download(d.storage_path);
          if (result.error) throw result.error;
          texto = (await result.data.text()).slice(0, 500_000);
        }
      }
      if (activo) setContenido({ id: d.id, url: data.signedUrl, texto });
    })().catch((e: unknown) => {
      if (activo) setError(mensajeError(e));
    });
    return () => {
      activo = false;
    };
  }, [documento]);

  const actual = contenido?.id === documento?.id ? contenido : null;
  const pdf =
    documento?.mime_type === "application/pdf" ||
    /\.pdf$/i.test(documento?.nombre ?? "");
  const imagen =
    /^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(documento?.mime_type ?? "");

  return (
    <Dialog open={!!documento} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {documento?.nombre}
          </DialogTitle>
          <DialogDescription>
            Vista previa · v{documento?.version}
          </DialogDescription>
        </DialogHeader>
        {error ? <p role="alert">{error}</p> : !actual ? (
          <p role="status">Cargando vista previa…</p>
        ) : (
          <>
            {pdf ? (
              <iframe
                title={documento?.nombre}
                src={actual.url}
                className="h-[65vh] w-full rounded border border-border"
              />
            ) : imagen ? (
              <img
                src={actual.url}
                alt={documento?.nombre}
                className="max-h-[65vh] w-full object-contain"
              />
            ) : actual.texto !== null ? (
              <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap rounded bg-muted p-4 text-sm">
                {actual.texto}
              </pre>
            ) : (
              <p className="text-muted-foreground">
                Este formato no admite vista previa.
              </p>
            )}
            <Button asChild variant="outline">
              <a href={actual.url} target="_blank" rel="noopener noreferrer">
                Abrir / descargar
              </a>
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CompartirDocumento({
  documento,
  onClose,
}: {
  documento: Documento;
  onClose: () => void;
}) {
  const { estudioId, user } = useEstudio();
  const qc = useQueryClient();
  const [horas, setHoras] = useState("24");
  const [creado, setCreado] = useState("");
  const enlaces = useQuery(enlacesDocumentoQuery(estudioId, documento.id));

  async function actualizar() {
    await qc.invalidateQueries({
      queryKey: ["enlaces-documento", estudioId, documento.id],
    });
  }

  const crear = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("enlaces_documento")
        .insert({
          estudio_id: estudioId,
          documento_id: documento.id,
          created_by: user.id,
          expira_at: new Date(
            Date.now() + Number(horas) * 3_600_000,
          ).toISOString(),
        })
        .select("token")
        .single();
      if (error) throw error;
      return `${window.location.origin}/enlace/${data.token}`;
    },
    onSuccess: async (url) => {
      setCreado(url);
      await actualizar();
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  const revocar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("enlaces_documento")
        .update({ revocado: true })
        .eq("id", id)
        .eq("estudio_id", estudioId)
        .eq("documento_id", documento.id);
      if (error) throw error;
    },
    onSuccess: actualizar,
    onError: (e) => toast.error(mensajeError(e)),
  });

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar. Seleccione y copie el enlace.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Compartir enlace</DialogTitle>
          <DialogDescription>
            {documento.nombre} · v{documento.version}. Cualquier persona con
            el enlace podrá descargar esta versión hasta su vencimiento.
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-2">
          Vigencia
          <NativeSelect value={horas} onChange={(e) => setHoras(e.target.value)}>
            <option value="1">1 hora</option>
            <option value="24">24 horas</option>
            <option value="168">7 días</option>
            <option value="720">30 días</option>
          </NativeSelect>
        </label>
        <Button disabled={crear.isPending} onClick={() => crear.mutate()}>
          {crear.isPending ? "Creando…" : "Crear enlace"}
        </Button>
        {creado && (
          <div className="grid gap-2">
            <input
              aria-label="Enlace creado"
              className="w-full rounded border border-border bg-background p-2 text-sm"
              readOnly
              value={creado}
              onFocus={(e) => e.target.select()}
            />
            <Button variant="outline" onClick={() => copiar(creado)}>
              Copiar enlace
            </Button>
          </div>
        )}
        {enlaces.isPending && <p>Cargando enlaces…</p>}
        {enlaces.isError && <p role="alert">{mensajeError(enlaces.error)}</p>}
        <ul className="divide-y divide-border">
          {enlaces.data?.map((enlace) => {
            const vencido = new Date(enlace.expira_at).getTime() <= Date.now();
            return (
              <li key={enlace.id} className="grid gap-2 py-3 text-sm">
                <p>
                  {enlace.vistas} vistas · vence{" "}
                  {new Date(enlace.expira_at).toLocaleString("es-PE")}
                </p>
                <p className="text-muted-foreground">
                  {enlace.revocado ? "Revocado" : vencido ? "Vencido" : "Activo"}
                </p>
                {!enlace.revocado && !vencido && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        copiar(
                          `${window.location.origin}/enlace/${enlace.token}`,
                        )
                      }
                    >
                      Copiar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revocar.isPending}
                      onClick={() => revocar.mutate(enlace.id)}
                    >
                      Revocar
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentosExpediente({
  expedienteId,
  clienteId,
}: {
  expedienteId: string;
  clienteId?: string | null;
}) {
  const documentos = useQuery(documentosQuery(expedienteId));
  const { puedeEliminar } = useEstudio();
  const qc = useQueryClient();
  const eliminar = useMutation({
    mutationFn: async (doc: Documento) => {
      const familia = familiaDocumento(doc);
      const rows = (documentos.data ?? []).filter((x) => familiaDocumento(x) === familia);
      const { error } = await supabase.from("documentos").delete().eq("id", familia);
      if (error) throw error;
      await supabase.storage.from("documentos").remove(rows.map((r) => r.storage_path));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["documentos", expedienteId] });
      toast.success("Documento eliminado");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });
  const [preview, setPreview] = useState<Documento | null>(null);
  const [versiones, setVersiones] = useState<Documento | null>(null);
  const [compartir, setCompartir] = useState<Documento | null>(null);
  const latest = ultimasVersiones(documentos.data ?? []);

  return (
    <>
      <Panel
        title="Documentos"
        action={<DocumentUpload expedienteId={expedienteId} clienteId={clienteId} />}
      >
        <Button asChild size="sm" variant="outline">
          <Link to="/asistente" search={{ expediente: expedienteId }}>
            Preguntar a la IA
          </Link>
        </Button>
        {documentos.isPending && <p role="status">Cargando documentos…</p>}
        {documentos.isError && (
          <p role="alert">{mensajeError(documentos.error)}</p>
        )}
        {documentos.isSuccess && latest.length === 0 && (
          <p className="py-4 text-muted-foreground">
            Sin documentos. Suba archivos de hasta 50 MB.
          </p>
        )}
        <ul className="divide-y divide-border">
          {latest.map((d) => (
            <li key={d.id} className="grid gap-3 py-4">
              <div className="flex items-center gap-2">
                <span className="min-w-0 break-words font-medium">{d.nombre}</span>
                <Badge variant="secondary">v{d.version}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {d.categoria} ·{" "}
                {new Date(d.created_at).toLocaleDateString("es-PE")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setPreview(d)}>
                  Vista previa
                </Button>
                <Button size="sm" variant="outline" onClick={() => setVersiones(d)}>
                  Versiones
                </Button>
                <DocumentUpload
                  expedienteId={expedienteId}
                  clienteId={clienteId}
                  documento={d}
                />
                <Button size="sm" variant="outline" onClick={() => setCompartir(d)}>
                  Compartir enlace
                </Button>
                <ToggleVisibleCliente documento={d} />
                <IniciarCronometro expedienteId={expedienteId} documentoId={d.id} descripcion={`Revisión: ${d.nombre}`} />
                {puedeEliminar && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={eliminar.isPending}
                    onClick={() => {
                      if (confirm("¿Eliminar este documento y todas sus versiones?")) eliminar.mutate(d);
                    }}
                  >
                    Eliminar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
      <Dialog
        open={!!versiones}
        onOpenChange={(open) => !open && setVersiones(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Versiones</DialogTitle>
            <DialogDescription>{versiones?.nombre}</DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-border">
            {(documentos.data ?? [])
              .filter(
                (d) =>
                  versiones &&
                  familiaDocumento(d) === familiaDocumento(versiones),
              )
              .sort((a, b) => b.version - a.version)
              .map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-3">
                  <span>
                    v{d.version} · {new Date(d.created_at).toLocaleString("es-PE")}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPreview(d)}>
                      Abrir
                    </Button>
                    
                  </div>
                </li>
              ))}
          </ul>
        </DialogContent>
      </Dialog>
      {compartir && (
        <CompartirDocumento
          key={compartir.id}
          documento={compartir}
          onClose={() => setCompartir(null)}
        />
      )}
      <DocumentoPreview documento={preview} onClose={() => setPreview(null)} />
    </>
  );
}
