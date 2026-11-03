import { createFileRoute } from "@tanstack/react-router";

const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

function pagina(status: number, mensaje: string) {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Documento · Kevelegal</title></head><body><main><h1>Documento no disponible</h1><p>${mensaje}</p></main></body></html>`,
    {
      status,
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      },
    },
  );
}

export const Route = createFileRoute("/api/public/enlace/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[a-f0-9]{64}$/.test(params.token)) {
          return pagina(404, "El enlace no existe.");
        }

        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          const lookup = await supabaseAdmin
            .from("enlaces_documento")
            .select("*")
            .eq("token", params.token)
            .maybeSingle();

          if (lookup.error) return pagina(503, "Inténtelo nuevamente más tarde.");
          const enlace = lookup.data;
          if (!enlace) return pagina(404, "El enlace no existe.");
          if (
            enlace.revocado ||
            new Date(enlace.expira_at).getTime() <= Date.now()
          ) {
            return pagina(410, "El enlace ha vencido o fue revocado.");
          }

          const doc = await supabaseAdmin
            .from("documentos")
            .select("nombre,storage_path")
            .eq("id", enlace.documento_id)
            .eq("estudio_id", enlace.estudio_id)
            .maybeSingle();

          if (doc.error) return pagina(503, "Inténtelo nuevamente más tarde.");
          if (!doc.data) return pagina(404, "El documento ya no está disponible.");
          if (!doc.data.storage_path.startsWith(`${enlace.estudio_id}/`)) {
            return pagina(404, "El documento no está disponible.");
          }

          const signed = await supabaseAdmin.storage
            .from("documentos")
            .createSignedUrl(doc.data.storage_path, 60, {
              download: doc.data.nombre,
            });

          if (signed.error) {
            return pagina(503, "No se pudo preparar la descarga.");
          }

          // Optimistic compare-and-swap prevents lost increments.
          let vistas = enlace.vistas;
          let actualizado = false;
          for (let intento = 0; intento < 12; intento++) {
            const update = await supabaseAdmin
              .from("enlaces_documento")
              .update({ vistas: vistas + 1 })
              .eq("id", enlace.id)
              .eq("vistas", vistas)
              .eq("revocado", false)
              .gt("expira_at", new Date().toISOString())
              .select("id");

            if (update.error) {
              return pagina(503, "Inténtelo nuevamente más tarde.");
            }
            if (update.data.length > 0) {
              actualizado = true;
              break;
            }

            const current = await supabaseAdmin
              .from("enlaces_documento")
              .select("vistas,revocado,expira_at")
              .eq("id", enlace.id)
              .maybeSingle();

            if (current.error) {
              return pagina(503, "Inténtelo nuevamente más tarde.");
            }
            if (
              !current.data ||
              current.data.revocado ||
              new Date(current.data.expira_at).getTime() <= Date.now()
            ) {
              return pagina(410, "El enlace ha vencido o fue revocado.");
            }
            vistas = current.data.vistas;
          }

          if (!actualizado) {
            return pagina(503, "El enlace está ocupado. Inténtelo nuevamente.");
          }

          return new Response(null, {
            status: 302,
            headers: { ...headers, Location: signed.data.signedUrl },
          });
        } catch {
          return pagina(503, "No se pudo preparar la descarga.");
        }
      },
    },
  },
});
