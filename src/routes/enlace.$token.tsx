import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { supabase } from "@/lib/demo-db/client";
import { leerArchivo } from "@/lib/demo-archivos";
import { Logo } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/enlace/$token")({
  head: () => ({
    meta: [
      { title: "Documento compartido — Kevelegal" },
      { name: "description", content: "Documento compartido por su estudio jurídico mediante un enlace seguro que caduca." },
      { property: "og:title", content: "Documento compartido — Kevelegal" },
      { property: "og:description", content: "Enlace seguro de documento de Kevelegal." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EnlacePage,
});

type Estado =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "ok"; nombre: string; url: string; mime: string; expira: string };

const MENSAJES: Record<string, string> = {
  no_existe: "Este enlace no existe.",
  revocado: "El estudio revocó este enlace.",
  caducado: "Este enlace ya caducó. Pida uno nuevo a su estudio.",
};

function EnlacePage() {
  const { token } = Route.useParams();
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  useEffect(() => {
    let url = "";
    void (async () => {
      const { data, error } = await supabase.rpc("abrir_enlace" as never, { _token: token } as never);
      const r = data as unknown as { estado: string; nombre?: string; mime?: string; path?: string; expira_at?: string } | null;
      if (error || !r) return setEstado({ tipo: "error", mensaje: "No se pudo abrir el enlace." });
      if (r.estado !== "ok" || !r.path) return setEstado({ tipo: "error", mensaje: MENSAJES[r.estado] ?? "Enlace no disponible." });
      const blob = await leerArchivo(r.path);
      if (!blob) return setEstado({ tipo: "error", mensaje: "El archivo no está disponible en este navegador (modo demostración)." });
      url = URL.createObjectURL(blob);
      setEstado({ tipo: "ok", nombre: r.nombre ?? "documento", url, mime: r.mime ?? blob.type, expira: r.expira_at ?? "" });
    })();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [token]);

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto grid max-w-4xl gap-6">
        <Logo />
        {estado.tipo === "cargando" && <p role="status">Abriendo documento…</p>}
        {estado.tipo === "error" && (
          <section className="rounded-xl border border-border bg-card p-8 text-center">
            <h1 className="font-display text-2xl">No podemos abrir este documento</h1>
            <p className="mt-2 text-muted-foreground">{estado.mensaje}</p>
          </section>
        )}
        {estado.tipo === "ok" && (
          <section className="grid gap-4 rounded-xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-primary" />
                <div>
                  <h1 className="font-display text-xl">{estado.nombre}</h1>
                  {estado.expira && (
                    <p className="text-xs text-muted-foreground">
                      Disponible hasta {new Date(estado.expira).toLocaleString("es-PE", { timeZone: "America/Lima" })}
                    </p>
                  )}
                </div>
              </div>
              <Button asChild>
                <a href={estado.url} download={estado.nombre}><Download /> Descargar</a>
              </Button>
            </div>
            {/^(application\/pdf|image\/|text\/)/.test(estado.mime) && (
              <iframe title={estado.nombre} src={estado.url} className="h-[75vh] w-full rounded-md border border-border bg-background" />
            )}
          </section>
        )}
      </div>
    </main>
  );
}
