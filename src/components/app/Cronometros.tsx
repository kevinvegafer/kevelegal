import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Timer } from "lucide-react";
import { supabase } from "@/lib/demo-db/client";
import { useEstudio } from "@/hooks/use-estudio";
import { tiempoQuery, segundosActuales, type RegistroTiempo } from "@/lib/queries-tiempo";
import { expedientesQuery } from "@/lib/queries";
import { formatDuracion, hoyLima } from "@/lib/cobranza";
import { mensajeError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Field, FormDialog, NativeSelect } from "@/components/app/ui";

type InicioProps = {
  expedienteId?: string;
  plazoId?: string;
  documentoId?: string;
  descripcion?: string;
};
export function IniciarCronometro({
  expedienteId,
  plazoId,
  documentoId,
  descripcion,
}: InicioProps) {
  const { estudioId, user } = useEstudio();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("registros_tiempo")
        .insert({
          estudio_id: estudioId,
          user_id: user.id,
          expediente_id: expedienteId ?? null,
          plazo_id: plazoId ?? null,
          documento_id: documentoId ?? null,
          descripcion: descripcion ?? "",
          fecha: hoyLima(),
          en_curso: true,
          ultimo_inicio: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tiempo"] });
      toast.success("Cronómetro iniciado");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });
  return (
    <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate()}>
      <Timer />
      Iniciar cronómetro
    </Button>
  );
}
export function CronometrosBarra() {
  const { estudioId, user } = useEstudio();
  const qc = useQueryClient();
  const q = useQuery(tiempoQuery(estudioId));
  const { data: expedientes = [] } = useQuery(expedientesQuery(estudioId));
  const [ahora, setAhora] = useState(Date.now());
  const [nuevo, setNuevo] = useState(false);
  const [exp, setExp] = useState("");
  const [guardar, setGuardar] = useState<RegistroTiempo | null>(null);
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const propios = (q.data ?? []).filter((r) => r.user_id === user.id && !r.honorario_id);
  const activos = propios
    .filter((r) => r.en_curso)
    .sort((a, b) => (b.ultimo_inicio ?? "").localeCompare(a.ultimo_inicio ?? ""));
  // The schema has no separate draft state. Paused rows are saved entries, resumable here and on /tiempo.
  const m = useMutation({
    mutationFn: async ({
      r,
      accion,
      descripcion,
    }: {
      r: RegistroTiempo;
      accion: "pausar" | "reanudar" | "guardar";
      descripcion?: string;
    }) => {
      const { data, error } = await supabase
        .from("registros_tiempo")
        .update({
          en_curso: accion === "reanudar",
          ultimo_inicio: accion === "reanudar" ? new Date().toISOString() : null,
          segundos: segundosActuales(r),
          ...(descripcion === undefined ? {} : { descripcion }),
        })
        .eq("estudio_id", estudioId)
        .eq("user_id", user.id)
        .eq("id", r.id)
        .eq("updated_at", r.updated_at)
        .is("honorario_id", null)
        .select("id");
      if (error) throw error;
      if (!data.length)
        throw new Error("El registro cambió. Actualice antes de intentar nuevamente.");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tiempo"] });
      setGuardar(null);
    },
    onError: (e) => {
      void qc.invalidateQueries({ queryKey: ["tiempo"] });
      toast.error(mensajeError(e));
    },
  });
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" aria-label={`${activos.length} cronómetros en curso`} className="shrink-0">
            <Timer />
            <span className="tabular-nums">{activos.length}</span>
            <span className="hidden sm:inline">en curso</span>
            {activos[0] && (
              <span className="hidden tabular-nums sm:inline">
                · {formatDuracion(segundosActuales(activos[0], ahora))}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 max-w-[95vw] max-h-[75vh] overflow-auto" align="end">
          <p className="font-display text-lg">Mis cronómetros</p>
          <p className="text-xs text-muted-foreground">
            Los pausados ya están guardados; puede reanudarlos. Pueden correr varios a la vez.
          </p>
          {q.isError && <p role="alert">{mensajeError(q.error)}</p>}
          {propios.map((r) => (
            <div key={r.id} className="border-b border-border py-3">
              <p>{r.descripcion || "Sin descripción"}</p>
              <p className="text-xs text-muted-foreground">
                {r.fecha} ·{" "}
                {expedientes.find((e) => e.id === r.expediente_id)?.titulo ?? "Sin expediente"} ·{" "}
                {formatDuracion(segundosActuales(r, ahora))}
              </p>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={m.isPending}
                  onClick={() => m.mutate({ r, accion: r.en_curso ? "pausar" : "reanudar" })}
                >
                  {r.en_curso ? "Pausar" : "Reanudar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={m.isPending}
                  onClick={() => setGuardar(r)}
                >
                  Detener y describir
                </Button>
              </div>
            </div>
          ))}
          {!propios.length && <p className="py-3 text-muted-foreground">Sin registros abiertos.</p>}
          <Button className="mt-3" onClick={() => setNuevo(true)}>
            Nuevo cronómetro
          </Button>
        </PopoverContent>
      </Popover>
      <FormDialog
        open={nuevo}
        onOpenChange={setNuevo}
        title="Nuevo cronómetro"
        onSubmit={(e) => {
          e.preventDefault();
          setNuevo(false);
        }}
        submitLabel="Cerrar"
      >
        <Field label="Expediente opcional">
          <NativeSelect value={exp} onChange={(e) => setExp(e.target.value)}>
            <option value="">Sin expediente</option>
            {expedientes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.titulo}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <IniciarCronometro {...(exp ? { expedienteId: exp } : {})} />
      </FormDialog>
      <FormDialog
        open={!!guardar}
        onOpenChange={(o) => {
          if (!o) setGuardar(null);
        }}
        title="Guardar tiempo trabajado"
        submitting={m.isPending}
        onSubmit={(e) => {
          e.preventDefault();
          if (guardar)
            m.mutate({
              r: guardar,
              accion: "guardar",
              descripcion: String(new FormData(e.currentTarget).get("descripcion") ?? "").trim(),
            });
        }}
      >
        <Field label="Descripción">
          <Input
            key={guardar?.id}
            name="descripcion"
            required
            defaultValue={guardar?.descripcion ?? ""}
          />
        </Field>
      </FormDialog>
    </>
  );
}
