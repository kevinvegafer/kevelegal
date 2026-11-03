import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import JSZip from "jszip";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { useEstudio } from "@/hooks/use-estudio";
import { supabase } from "@/integrations/supabase/client";
import { tablasRespaldo, leerTabla, csv, descargar } from "@/lib/exportar-datos";
import { hoyLima } from "@/lib/cobranza";
import { mensajeError } from "@/lib/errors";
import { PageHeader, EmptyState, Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
export const Route = createFileRoute("/_authenticated/_estudio/respaldo")({
  head: () => ({
    meta: [
      { title: "Respaldo completo — Kevelegal" },
      { name: "description", content: "Exporte los datos y archivos de su estudio." },
      { property: "og:title", content: "Respaldo completo — Kevelegal" },
      {
        property: "og:description",
        content: "Descargue una copia privada de los datos del estudio.",
      },
    ],
  }),
  component: Respaldo,
});
function Respaldo() {
  const { estudioId, esAdmin } = useEstudio();
  const [archivos, setArchivos] = useState(false),
    [ocupado, setOcupado] = useState(false),
    [progreso, setProgreso] = useState(0),
    [paso, setPaso] = useState("");
  async function exportar() {
    if (!esAdmin || ocupado) return;
    setOcupado(true);
    setProgreso(0);
    try {
      const zip = new JSZip();
      let documentos: Awaited<ReturnType<typeof leerTabla<"documentos">>> = [];
      for (const [i, tabla] of tablasRespaldo.entries()) {
        setPaso(`Exportando ${tabla}`);
        const rows = await leerTabla(tabla, estudioId);
        zip.file(`${tabla}.json`, JSON.stringify(rows, null, 2));
        zip.file(`${tabla}.csv`, csv(rows));
        if (tabla === "documentos") documentos = rows as typeof documentos;
        setProgreso(((i + 1) / tablasRespaldo.length) * (archivos ? 45 : 85));
      }
      if (archivos) {
        const paths = [...new Set(documentos.map((d) => d.storage_path))];
        for (const [i, path] of paths.entries()) {
          if (
            !path.startsWith(estudioId + "/") ||
            path.split("/").some((p) => p === ".." || p === "." || p === "")
          )
            throw new Error("Ruta de archivo no válida");
          setPaso(`Descargando archivo ${i + 1} de ${paths.length}`);
          const { data, error } = await supabase.storage
            .from("documentos")
            .createSignedUrl(path, 120);
          if (error) throw error;
          const response = await fetch(data.signedUrl);
          if (!response.ok) throw new Error(`No se pudo descargar ${path}`);
          zip.file(`files/${path}`, await response.blob());
          setProgreso(45 + ((i + 1) / Math.max(paths.length, 1)) * 40);
        }
      }
      zip.file(
        "README.txt",
        `Kevelegal — respaldo del estudio ${estudioId}\nGenerado: ${new Date().toISOString()}\nUn JSON y CSV por tabla. JSON conserva tipos; CSV usa BOM UTF-8 y neutraliza fórmulas para Excel.\nArchivos incluidos: ${archivos ? "sí, referenciados por documentos.storage_path" : "no; solo metadatos"}\nLos datos se leen por páginas de 1000 filas bajo RLS. No es una instantánea transaccional: evite cambios durante la exportación.\nNo incluye credenciales, enlaces de acceso, usuarios de Auth ni objetos huérfanos sin metadatos.\nProteja este ZIP: contiene datos personales y jurídicos. No se ofrece restauración automática.\n`,
      );
      setPaso("Comprimiendo");
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" }, (m) =>
        setProgreso(85 + m.percent * 0.15),
      );
      descargar(blob, `kevelegal-respaldo-${hoyLima()}.zip`);
      setPaso("Respaldo descargado");
      toast.success("Respaldo preparado");
    } catch (e) {
      setPaso("Exportación interrumpida; no se descargó un respaldo incompleto.");
      toast.error(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }
  if (!esAdmin)
    return (
      <EmptyState
        icon={Shield}
        title="Solo administradores"
        description="El respaldo completo requiere permisos de administrador."
      />
    );
  return (
    <>
      <PageHeader
        title="Respaldo completo"
        description="Descargue una copia privada de los datos de este estudio."
      />
      <Panel title="Exportación ZIP">
        <p className="text-sm text-muted-foreground mb-4">
          Incluye 20 tablas en JSON y CSV. Evite cambios durante la exportación; la lectura paginada
          no es una instantánea transaccional. El ZIP se prepara en este navegador y puede requerir
          bastante memoria si incluye archivos.
        </p>
        <label className="flex gap-2 mb-4">
          <input
            type="checkbox"
            checked={archivos}
            disabled={ocupado}
            onChange={(e) => setArchivos(e.target.checked)}
          />
          Incluir archivos de documentos
        </label>
        <Button disabled={ocupado} onClick={() => void exportar()}>
          {ocupado ? "Preparando…" : "Descargar respaldo completo"}
        </Button>
        <p aria-live="polite" className="my-3 text-sm">
          {paso}
        </p>
        <Progress value={progreso} />
      </Panel>
    </>
  );
}
