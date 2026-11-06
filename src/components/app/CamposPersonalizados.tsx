import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/demo-db/client";
import { camposPersonalizadosQuery, type Expediente } from "@/lib/queries";
import { MATERIAS, labelOf } from "@/lib/peru";
import { mensajeError } from "@/lib/errors";
import { useEstudio } from "@/hooks/use-estudio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, Panel } from "@/components/app/ui";

const TIPOS = [
  { value: "texto", label: "Texto" },
  { value: "numero", label: "Número" },
  { value: "fecha", label: "Fecha" },
  { value: "casilla", label: "Casilla (sí/no)" },
];

/** Configuración: define campos extra, opcionalmente por materia. */
export function CamposPersonalizadosConfig() {
  const { estudioId, puedeEliminar } = useEstudio();
  const qc = useQueryClient();
  const { data: campos = [] } = useQuery(camposPersonalizadosQuery(estudioId));
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("texto");
  const [materia, setMateria] = useState("");

  const crear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("campos_personalizados").insert({
        estudio_id: estudioId,
        nombre: nombre.trim(),
        tipo,
        materia: materia || null,
        orden: campos.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNombre("");
      qc.invalidateQueries({ queryKey: ["campos-personalizados"] });
      toast.success("Campo agregado");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });
  const borrar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campos_personalizados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campos-personalizados"] }),
    onError: (e) => toast.error(mensajeError(e)),
  });

  return (
    <Panel title="Campos personalizados de expedientes">
      <p className="mb-4 text-sm text-muted-foreground">
        Datos extra que quiera registrar en cada expediente. Si elige una materia, el campo solo aparece en esos casos.
      </p>
      <ul className="mb-4 divide-y divide-border">
        {campos.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="flex-1 font-medium">{c.nombre}</span>
            <span className="text-muted-foreground">{labelOf(TIPOS, c.tipo)}</span>
            <span className="w-32 text-muted-foreground">{c.materia ? labelOf(MATERIAS, c.materia) : "Todas"}</span>
            {puedeEliminar && (
              <Button size="icon" variant="ghost" aria-label="Eliminar campo" onClick={() => borrar.mutate(c.id)}>
                <Trash2 />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nombre.trim()) crear.mutate();
        }}
      >
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Fecha del accidente" className="w-56" />
        <NativeSelect value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-auto">
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </NativeSelect>
        <NativeSelect value={materia} onChange={(e) => setMateria(e.target.value)} className="w-auto">
          <option value="">Todas las materias</option>
          {MATERIAS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </NativeSelect>
        <Button type="submit" disabled={crear.isPending}>
          <Plus /> Agregar
        </Button>
      </form>
    </Panel>
  );
}

type Valores = Record<string, string | number | boolean | null>;

/** Detalle de expediente: muestra y edita en línea los campos extra. */
export function CamposExtraExpediente({ expediente }: { expediente: Expediente }) {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  const { data: campos = [] } = useQuery(camposPersonalizadosQuery(estudioId));
  const aplicables = campos.filter((c) => !c.materia || c.materia === expediente.materia);
  const valores = (expediente.campos_extra ?? {}) as Valores;

  const guardar = useMutation({
    mutationFn: async (nuevos: Valores) => {
      const { error } = await supabase.from("expedientes").update({ campos_extra: nuevos }).eq("id", expediente.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expediente", expediente.id] });
      toast.success("Guardado");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  if (aplicables.length === 0) return null;
  const set = (id: string, v: string | number | boolean | null) => {
    if (valores[id] === v) return;
    guardar.mutate({ ...valores, [id]: v });
  };

  return (
    <Panel title="Campos personalizados" className="mb-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {aplicables.map((c) => {
          const v = valores[c.id];
          return (
            <label key={c.id} className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">{c.nombre}</span>
              {c.tipo === "casilla" ? (
                <input type="checkbox" className="size-4" checked={v === true} onChange={(e) => set(c.id, e.target.checked)} />
              ) : (
                <Input
                  type={c.tipo === "fecha" ? "date" : c.tipo === "numero" ? "number" : "text"}
                  defaultValue={v == null ? "" : String(v)}
                  onBlur={(e) => {
                    const raw = e.target.value;
                    set(c.id, raw === "" ? null : c.tipo === "numero" ? Number(raw) : raw);
                  }}
                />
              )}
            </label>
          );
        })}
      </div>
    </Panel>
  );
}
