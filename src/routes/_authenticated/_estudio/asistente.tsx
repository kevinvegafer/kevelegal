import { Fragment, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEstudio } from "@/hooks/use-estudio";
import { documentosQuery, expedientesQuery } from "@/lib/queries";
import { ultimasVersiones, type Documento } from "@/lib/documentos.queries";
import { consultarDocumentos } from "@/lib/asistente.functions";
import { mensajeError } from "@/lib/errors";
import { DocumentoPreview } from "@/components/app/Documentos";
import { PageHeader, Panel, NativeSelect } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/_estudio/asistente")({
  validateSearch: (search: Record<string, unknown>) => ({
    expediente:
      typeof search["expediente"] === "string"
        ? search["expediente"]
        : "",
  }),
  head: () => ({
    meta: [
      { title: "Asistente documental con IA · Kevelegal" },
      {
        name: "description",
        content: "Consulte y resuma documentos de sus expedientes con fuentes verificables.",
      },
      { property: "og:title", content: "Asistente documental con IA · Kevelegal" },
      {
        property: "og:description",
        content: "Respuestas basadas en documentos del expediente y citas a sus fuentes.",
      },
    ],
  }),
  component: AsistentePage,
});

type Entrada = {
  id: string;
  pregunta: string;
  respuesta: string;
  fuentes: { n: number; documentoId: string; nombre: string }[];
  documentos: Documento[];
};

function AsistentePage() {
  const { estudioId } = useEstudio();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [historial, setHistorial] = useState<Entrada[]>([]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asistente documental"
        description="Resuma o consulte hasta 8 documentos, con un máximo total de 20 MB."
      />
      <Consulta
        key={`${estudioId}:${search.expediente}`}
        expedienteId={search.expediente}
        cambiarExpediente={(id) =>
          void navigate({ search: { expediente: id }, replace: true })
        }
        historial={historial}
        agregar={(entrada) => setHistorial((prev) => [entrada, ...prev])}
      />
    </div>
  );
}

function Consulta({
  expedienteId,
  cambiarExpediente,
  historial,
  agregar,
}: {
  expedienteId: string;
  cambiarExpediente: (id: string) => void;
  historial: Entrada[];
  agregar: (entrada: Entrada) => void;
}) {
  const { estudioId } = useEstudio();
  const consultar = useServerFn(consultarDocumentos);
  const expedientes = useQuery(expedientesQuery(estudioId));
  const documentos = useQuery({
    ...documentosQuery(expedienteId),
    enabled: !!expedienteId,
  });
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const bloqueo = useRef(false);
  const [preview, setPreview] = useState<Documento | null>(null);
  const latest = ultimasVersiones(documentos.data ?? []);
  const elegidos = latest.filter((d) => seleccion.includes(d.id));

  async function enviar(modo: "resumen" | "pregunta") {
    if (bloqueo.current) return;
    if (!elegidos.length || elegidos.length > 8) {
      toast.error("Seleccione entre 1 y 8 documentos.");
      return;
    }
    if (modo === "pregunta" && !pregunta.trim()) {
      toast.error("Escriba una pregunta.");
      return;
    }

    bloqueo.current = true;
    setPendiente(true);
    try {
      const result = await consultar({
        data: {
          estudioId,
          documentoIds: elegidos.map((d) => d.id),
          pregunta,
          modo,
        },
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      agregar({
        id: crypto.randomUUID(),
        pregunta: modo === "resumen" ? "Resumir documentos" : pregunta,
        respuesta: result.respuesta,
        fuentes: result.fuentes,
        documentos: elegidos,
      });
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      bloqueo.current = false;
      setPendiente(false);
    }
  }

  return (
    <>
      <Panel title="Documentos de consulta">
        <label className="grid gap-2">
          Expediente
          <NativeSelect
            value={expedienteId}
            disabled={pendiente}
            onChange={(e) => cambiarExpediente(e.target.value)}
          >
            <option value="">Seleccione un expediente</option>
            {expedientes.data?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.numero_expediente ? `${e.numero_expediente} · ` : ""}{e.titulo}
              </option>
            ))}
          </NativeSelect>
        </label>
        {expedientes.isError && (
          <p role="alert">{mensajeError(expedientes.error)}</p>
        )}
        {expedienteId && documentos.isPending && <p>Cargando documentos…</p>}
        {documentos.isError && (
          <p role="alert">{mensajeError(documentos.error)}</p>
        )}
        {expedienteId && documentos.isSuccess && !latest.length && (
          <p className="py-3 text-muted-foreground">
            Este expediente no tiene documentos.
          </p>
        )}
        <div className="space-y-3 py-4">
          {latest.map((d) => (
            <label key={d.id} className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={seleccion.includes(d.id)}
                disabled={
                  pendiente ||
                  (!seleccion.includes(d.id) && seleccion.length >= 8)
                }
                onChange={(e) =>
                  setSeleccion((prev) =>
                    e.target.checked
                      ? [...prev, d.id]
                      : prev.filter((id) => id !== d.id),
                  )
                }
              />
              <span>{d.nombre} · v{d.version}</span>
            </label>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {elegidos.length}/8 seleccionados. Se enviarán al servicio de IA
          únicamente los documentos elegidos.
        </p>
        <div className="mt-4 grid gap-3">
          <Button
            variant="outline"
            disabled={pendiente || !elegidos.length}
            onClick={() => enviar("resumen")}
          >
            Resumir
          </Button>
          <label className="grid gap-2">
            Pregunta
            <Textarea
              value={pregunta}
              maxLength={4000}
              disabled={pendiente}
              onChange={(e) => setPregunta(e.target.value)}
              placeholder="¿Qué fechas y obligaciones aparecen en estos documentos?"
            />
          </label>
          <Button
            disabled={pendiente || !elegidos.length || !pregunta.trim()}
            onClick={() => enviar("pregunta")}
          >
            {pendiente ? "Consultando…" : "Preguntar"}
          </Button>
          {pendiente && <p role="status">Analizando los documentos…</p>}
        </div>
      </Panel>

      <Panel title="Historial de esta sesión">
        {!historial.length && (
          <p className="text-muted-foreground">
            Las respuestas aparecerán aquí. El historial no se guarda.
          </p>
        )}
        <div className="space-y-6">
          {historial.map((entrada) => (
            <article key={entrada.id} className="space-y-3 border-b border-border pb-6">
              <h2 className="font-display font-semibold">{entrada.pregunta}</h2>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {entrada.respuesta.split(/(\[\d+\])/g).map((parte, index) => {
                  const match = /^\[(\d+)\]$/.exec(parte);
                  const fuente = match
                    ? entrada.fuentes.find((f) => f.n === Number(match[1]))
                    : undefined;
                  const doc = fuente
                    ? entrada.documentos.find((d) => d.id === fuente.documentoId)
                    : undefined;
                  return doc ? (
                    <button
                      key={index}
                      className="font-medium text-primary underline"
                      title={doc.nombre}
                      onClick={() => setPreview(doc)}
                    >
                      {parte}
                    </button>
                  ) : (
                    <Fragment key={index}>{parte}</Fragment>
                  );
                })}
              </div>
              <ul className="space-y-1 text-sm">
                {entrada.fuentes.map((fuente) => {
                  const doc = entrada.documentos.find(
                    (d) => d.id === fuente.documentoId,
                  );
                  return (
                    <li key={fuente.n}>
                      <button
                        className="text-primary underline"
                        disabled={!doc}
                        onClick={() => doc && setPreview(doc)}
                      >
                        [{fuente.n}] {fuente.nombre}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      </Panel>
      <DocumentoPreview documento={preview} onClose={() => setPreview(null)} />
    </>
  );
}
