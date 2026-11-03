import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ListChecks, Plus, Trash2, Upload, Workflow } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Plantilla, PlantillaItem } from "@/lib/queries";
import { TIPOS_EVENTO, calcularVencimiento, labelOf, parseISODate, toISODate } from "@/lib/peru";
import { mensajeError } from "@/lib/errors";
import { useEstudio } from "@/hooks/use-estudio";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormDialog, NativeSelect } from "@/components/app/ui";

export type PlantillaConItems = Plantilla & { items: PlantillaItem[] };

type DraftItem = {
  tipo: "tarea" | "evento";
  titulo: string;
  descripcion: string;
  dias: number;
  dias_habiles: boolean;
  prioridad: string;
  tipo_evento: string;
  hora: string;
  duracion_minutos: number;
};

const ITEM_VACIO: DraftItem = {
  tipo: "tarea",
  titulo: "",
  descripcion: "",
  dias: 1,
  dias_habiles: false,
  prioridad: "media",
  tipo_evento: "audiencia",
  hora: "09:00",
  duracion_minutos: 60,
};

function aDraft(it: PlantillaItem): DraftItem {
  return {
    tipo: it.tipo === "evento" ? "evento" : "tarea",
    titulo: it.titulo,
    descripcion: it.descripcion ?? "",
    dias: it.dias,
    dias_habiles: it.dias_habiles,
    prioridad: it.prioridad,
    tipo_evento: it.tipo_evento,
    hora: it.hora,
    duracion_minutos: it.duracion_minutos,
  };
}

/** Calcula las fechas de cada ítem a partir de la fecha de activación. */
export function calcularItems(items: PlantillaItem[], fechaBase: string) {
  const base = parseISODate(fechaBase);
  return items.map((it) => {
    if (it.tipo === "evento") {
      const dia = addDays(base, it.dias);
      const [hh = 9, mm = 0] = (it.hora || "09:00").split(":").map(Number);
      const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hh, mm);
      const fin = new Date(inicio.getTime() + (it.duracion_minutos || 60) * 60000);
      return {
        tipo: "evento" as const,
        titulo: it.titulo,
        tipo_evento: it.tipo_evento,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        descripcion: it.descripcion ?? "",
        fechaLegible: format(inicio, "EEE d MMM yyyy, HH:mm", { locale: es }),
      };
    }
    const venc = it.dias_habiles && it.dias > 0 ? calcularVencimiento(base, it.dias) : addDays(base, it.dias);
    return {
      tipo: "tarea" as const,
      titulo: it.titulo,
      prioridad: it.prioridad,
      dias: it.dias,
      dias_habiles: it.dias_habiles,
      fecha_base: fechaBase,
      fecha_vencimiento: toISODate(venc),
      descripcion: it.descripcion ?? "",
      fechaLegible: format(venc, "EEE d MMM yyyy", { locale: es }),
    };
  });
}

export function PlantillaForm({
  open,
  onOpenChange,
  plantilla,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plantilla?: PlantillaConItems | null;
}) {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(plantilla?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(plantilla?.descripcion ?? "");
  const [items, setItems] = useState<DraftItem[]>(
    plantilla ? [...plantilla.items].sort((a, b) => a.orden - b.orden).map(aDraft) : [],
  );

  function setItem(i: number, patch: Partial<DraftItem>) {
    setItems((arr) => arr.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }

  const m = useMutation({
    mutationFn: async () => {
      let plantillaId = plantilla?.id;
      if (plantillaId) {
        const { error } = await supabase
          .from("plantillas")
          .update({ nombre, descripcion: descripcion || null })
          .eq("id", plantillaId);
        if (error) throw error;
        const { error: delError } = await supabase.from("plantilla_items").delete().eq("plantilla_id", plantillaId);
        if (delError) throw delError;
      } else {
        const { data, error } = await supabase
          .from("plantillas")
          .insert({ estudio_id: estudioId, nombre, descripcion: descripcion || null })
          .select("id")
          .single();
        if (error) throw error;
        plantillaId = data.id;
      }
      if (items.length) {
        const { error } = await supabase.from("plantilla_items").insert(
          items.map((it, i) => ({
            plantilla_id: plantillaId!,
            estudio_id: estudioId,
            tipo: it.tipo,
            titulo: it.titulo,
            descripcion: it.descripcion || null,
            dias: it.dias,
            dias_habiles: it.tipo === "tarea" ? it.dias_habiles : false,
            prioridad: it.prioridad,
            tipo_evento: it.tipo_evento,
            hora: it.hora || "09:00",
            duracion_minutos: it.duracion_minutos || 60,
            orden: i,
          })),
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plantillas"] });
      toast.success(plantilla ? "Plantilla actualizada" : "Plantilla creada");
      onOpenChange(false);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nombre.trim()) return void toast.error("Ponga un nombre a la plantilla");
    if (items.length === 0) return void toast.error("Agregue al menos una tarea o evento");
    if (items.some((it) => !it.titulo.trim())) return void toast.error("Todas las filas necesitan un título");
    m.mutate();
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={plantilla ? "Editar plantilla" : "Nueva plantilla de proceso"}
      description="Defina una vez las tareas y eventos estándar. Las fechas se calculan solas al aplicarla a un expediente."
      onSubmit={submit}
      submitting={m.isPending}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre de la plantilla" htmlFor="nombre">
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Notificación de deposición"
          />
        </Field>
        <Field label="Descripción (opcional)" htmlFor="descripcion">
          <Input
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Úsela al recibir la notificación…"
          />
        </Field>
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Tareas y eventos ({items.length})</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setItems((a) => [...a, { ...ITEM_VACIO }])}>
              <ListChecks /> Tarea
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setItems((a) => [...a, { ...ITEM_VACIO, tipo: "evento" }])}
            >
              <CalendarDays /> Evento
            </Button>
          </div>
        </div>

        {items.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Agregue las tareas y eventos que se crearán automáticamente.
          </p>
        )}

        {items.map((it, i) => (
          <div key={i} className="grid gap-3 rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-center gap-2">
              <Badge variant={it.tipo === "evento" ? "primary" : "outline"}>
                {it.tipo === "evento" ? "Evento" : "Tarea"}
              </Badge>
              <Input
                className="h-8 flex-1"
                value={it.titulo}
                onChange={(e) => setItem(i, { titulo: e.target.value })}
                placeholder={it.tipo === "evento" ? "Audiencia de deposición" : "Preparar al cliente"}
                required
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Quitar"
                onClick={() => setItems((a) => a.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label={it.tipo === "evento" ? "Días después (fecha)" : "Vence a los (días)"}>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={it.dias}
                  onChange={(e) => setItem(i, { dias: Number(e.target.value) })}
                  required
                />
              </Field>
              {it.tipo === "tarea" ? (
                <>
                  <Field label="Cómputo">
                    <NativeSelect
                      value={it.dias_habiles ? "habiles" : "calendario"}
                      onChange={(e) => setItem(i, { dias_habiles: e.target.value === "habiles" })}
                    >
                      <option value="calendario">Días calendario</option>
                      <option value="habiles">Días hábiles</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Prioridad">
                    <NativeSelect value={it.prioridad} onChange={(e) => setItem(i, { prioridad: e.target.value })}>
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </NativeSelect>
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Tipo de evento">
                    <NativeSelect value={it.tipo_evento} onChange={(e) => setItem(i, { tipo_evento: e.target.value })}>
                      {TIPOS_EVENTO.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Hora">
                    <Input type="time" value={it.hora} onChange={(e) => setItem(i, { hora: e.target.value })} />
                  </Field>
                  <Field label="Duración (min)">
                    <Input
                      type="number"
                      min={15}
                      step={15}
                      value={it.duracion_minutos}
                      onChange={(e) => setItem(i, { duracion_minutos: Number(e.target.value) })}
                    />
                  </Field>
                </>
              )}
            </div>
            <Input
              className="h-8 text-xs"
              value={it.descripcion}
              onChange={(e) => setItem(i, { descripcion: e.target.value })}
              placeholder="Detalle u observaciones (opcional)"
            />
          </div>
        ))}
      </div>
    </FormDialog>
  );
}

export function AplicarPlantilla({
  open,
  onOpenChange,
  plantillas,
  expediente,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plantillas: PlantillaConItems[];
  expediente: { id: string; titulo: string; numero_expediente: string | null; cliente_id: string | null };
}) {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  const inputFile = useRef<HTMLInputElement>(null);
  const [plantillaId, setPlantillaId] = useState("");
  const [fechaBase, setFechaBase] = useState(toISODate(new Date()));
  const [archivo, setArchivo] = useState<File | null>(null);
  const [categoria, setCategoria] = useState("resolucion");

  const plantilla = plantillas.find((p) => p.id === plantillaId) ?? null;
  const itemsOrdenados = useMemo(
    () => (plantilla ? [...plantilla.items].sort((a, b) => a.orden - b.orden) : []),
    [plantilla],
  );
  const calculados = useMemo(
    () => (plantilla && fechaBase ? calcularItems(itemsOrdenados, fechaBase) : []),
    [plantilla, fechaBase, itemsOrdenados],
  );

  const m = useMutation({
    mutationFn: async () => {
      if (!plantilla) throw new Error("Seleccione una plantilla");
      if (archivo) {
        if (archivo.size > 50 * 1024 * 1024) throw new Error("El archivo supera 50 MB");
        const ext = archivo.name.includes(".") ? archivo.name.slice(archivo.name.lastIndexOf(".")) : "";
        const nuevoNombre = `${plantilla.nombre} - ${expediente.numero_expediente || expediente.titulo} - ${fechaBase}${ext}`;
        const limpio = nuevoNombre.replace(/[^\w.\-]+/g, "_");
        const path = `${estudioId}/${expediente.id}/${crypto.randomUUID()}-${limpio}`;
        const up = await supabase.storage.from("documentos").upload(path, archivo, { contentType: archivo.type });
        if (up.error) throw up.error;
        const { error } = await supabase.from("documentos").insert({
          estudio_id: estudioId,
          expediente_id: expediente.id,
          cliente_id: expediente.cliente_id,
          nombre: nuevoNombre,
          categoria,
          storage_path: path,
          mime_type: archivo.type || null,
          tamano: archivo.size,
        });
        if (error) {
          await supabase.storage.from("documentos").remove([path]);
          throw error;
        }
      }
      const { error } = await supabase.rpc("aplicar_plantilla", {
        _plantilla: plantilla.id,
        _expediente: expediente.id,
        _items: calculados,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plazos"] });
      qc.invalidateQueries({ queryKey: ["eventos"] });
      qc.invalidateQueries({ queryKey: ["documentos", expediente.id] });
      toast.success(
        archivo
          ? "Documento archivado y plantilla aplicada"
          : `Plantilla aplicada: ${calculados.length} registros creados`,
      );
      onOpenChange(false);
      setPlantillaId("");
      setArchivo(null);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Aplicar plantilla de proceso</DialogTitle>
          <DialogDescription>
            Se crearán todas las tareas y eventos de la plantilla en este expediente, con fechas calculadas desde la
            fecha de activación.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plantilla">
            <NativeSelect value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
              <option value="">— Seleccione —</option>
              {plantillas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.items.length})
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Fecha de activación" hint="Hoy, o la fecha de la notificación recibida">
            <Input type="date" value={fechaBase} onChange={(e) => setFechaBase(e.target.value)} required />
          </Field>
        </div>

        {calculados.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {calculados.map((c, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                {c.tipo === "evento" ? (
                  <CalendarDays className="size-4 shrink-0 text-primary" />
                ) : (
                  <ListChecks className="size-4 shrink-0 text-primary" />
                )}
                <span className="min-w-0 flex-1 truncate">{c.titulo}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{c.fechaLegible}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 rounded-lg border border-dashed border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Documento detonante (opcional): se renombra y archiva en la carpeta del expediente
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-auto">
              <option value="resolucion">Resolución</option>
              <option value="escrito">Escrito</option>
              <option value="prueba">Medio probatorio</option>
              <option value="contrato">Contrato</option>
              <option value="poder">Poder / vigencia</option>
              <option value="otro">Otro</option>
            </NativeSelect>
            <input
              ref={inputFile}
              type="file"
              className="hidden"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            <Button type="button" size="sm" variant="outline" onClick={() => inputFile.current?.click()}>
              <Upload /> {archivo ? archivo.name : "Elegir archivo"}
            </Button>
            {archivo && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setArchivo(null)}>
                Quitar
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="hero"
            disabled={!plantilla || !fechaBase || m.isPending}
            onClick={() => m.mutate()}
          >
            <Workflow /> {m.isPending ? "Aplicando…" : `Aplicar (${calculados.length} registros)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
