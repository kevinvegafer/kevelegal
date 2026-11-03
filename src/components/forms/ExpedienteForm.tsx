import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { clientesQuery, miembrosQuery, nombreCliente, type Expediente } from "@/lib/queries";
import {
  DISTRITOS_JUDICIALES,
  ESTADOS_EXPEDIENTE,
  MATERIAS,
  VIAS,
  esNumeroExpedientePJ,
} from "@/lib/peru";
import { mensajeError } from "@/lib/errors";
import { useEstudio } from "@/hooks/use-estudio";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog, NativeSelect, formValues, type FormVals } from "@/components/app/ui";

export function ExpedienteForm({
  open,
  onOpenChange,
  expediente,
  clienteId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expediente?: Expediente | null;
  clienteId?: string;
  onSaved?: (id: string) => void;
}) {
  const { estudioId, user } = useEstudio();
  const qc = useQueryClient();
  const { data: clientes = [] } = useQuery({ ...clientesQuery(estudioId), enabled: open });
  const { data: miembros = [] } = useQuery({ ...miembrosQuery(estudioId), enabled: open });
  const [numero, setNumero] = useState(expediente?.numero_expediente ?? "");

  const m = useMutation({
    mutationFn: async (v: FormVals) => {
      const payload = {
        estudio_id: estudioId,
        titulo: v.titulo ?? "",
        cliente_id: v.cliente_id,
        numero_expediente: v.numero_expediente?.toUpperCase() ?? null,
        materia: v.materia ?? "civil",
        via: v.via ?? "judicial",
        tipo_proceso: v.tipo_proceso,
        distrito_judicial: v.distrito_judicial,
        organo_jurisdiccional: v.organo_jurisdiccional,
        juez: v.juez,
        especialista: v.especialista,
        estado: v.estado ?? "en_tramite",
        etapa: v.etapa,
        cuantia: v.cuantia ? Number(v.cuantia) : null,
        fecha_inicio: v.fecha_inicio,
        responsable_id: v.responsable_id,
        descripcion: v.descripcion,
      };
      if (expediente) {
        const { error } = await supabase.from("expedientes").update(payload).eq("id", expediente.id);
        if (error) throw error;
        return expediente.id;
      }
      const { data, error } = await supabase.from("expedientes").insert(payload).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["expedientes"] });
      qc.invalidateQueries({ queryKey: ["expediente", id] });
      toast.success(expediente ? "Expediente actualizado" : "Expediente creado");
      onOpenChange(false);
      onSaved?.(id);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    if (!v.titulo) return void toast.error("Ingrese un título o carátula");
    m.mutate(v);
  }

  const muestraAviso = numero.trim() !== "" && !esNumeroExpedientePJ(numero);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={expediente ? "Editar expediente" : "Nuevo expediente"}
      onSubmit={submit}
      submitting={m.isPending}
      wide
    >
      <Field label="Carátula / título" htmlFor="titulo">
        <Input
          id="titulo"
          name="titulo"
          required
          defaultValue={expediente?.titulo}
          placeholder="Pérez c/ Constructora Andina — Indemnización"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente">
          <NativeSelect key={clientes.length} name="cliente_id" defaultValue={expediente?.cliente_id ?? clienteId ?? ""}>
            <option value="">— Sin cliente —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {nombreCliente(c)} · {c.numero_documento}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="N.° de expediente"
          htmlFor="numero_expediente"
          hint={muestraAviso ? "No sigue el formato del Poder Judicial (00123-2024-0-1801-JR-CI-01). Se guardará igual." : undefined}
        >
          <Input
            id="numero_expediente"
            name="numero_expediente"
            className="font-mono"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="00123-2024-0-1801-JR-CI-01"
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Vía">
          <NativeSelect name="via" defaultValue={expediente?.via ?? "judicial"}>
            {VIAS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Materia">
          <NativeSelect name="materia" defaultValue={expediente?.materia ?? "civil"}>
            {MATERIAS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Estado">
          <NativeSelect name="estado" defaultValue={expediente?.estado ?? "en_tramite"}>
            {ESTADOS_EXPEDIENTE.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de proceso" htmlFor="tipo_proceso">
          <Input
            id="tipo_proceso"
            name="tipo_proceso"
            defaultValue={expediente?.tipo_proceso ?? ""}
            placeholder="Conocimiento, abreviado, sumarísimo…"
          />
        </Field>
        <Field label="Etapa actual" htmlFor="etapa">
          <Input id="etapa" name="etapa" defaultValue={expediente?.etapa ?? ""} placeholder="Postulatoria, probatoria…" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Distrito judicial">
          <NativeSelect name="distrito_judicial" defaultValue={expediente?.distrito_judicial ?? "Lima"}>
            <option value="">—</option>
            {DISTRITOS_JUDICIALES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Órgano jurisdiccional" htmlFor="organo_jurisdiccional">
          <Input
            id="organo_jurisdiccional"
            name="organo_jurisdiccional"
            defaultValue={expediente?.organo_jurisdiccional ?? ""}
            placeholder="5.° Juzgado Civil de Lima"
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Juez" htmlFor="juez">
          <Input id="juez" name="juez" defaultValue={expediente?.juez ?? ""} />
        </Field>
        <Field label="Especialista legal" htmlFor="especialista">
          <Input id="especialista" name="especialista" defaultValue={expediente?.especialista ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Cuantía (S/)" htmlFor="cuantia">
          <Input
            id="cuantia"
            name="cuantia"
            type="number"
            step="0.01"
            min="0"
            defaultValue={expediente?.cuantia ?? ""}
          />
        </Field>
        <Field label="Fecha de inicio" htmlFor="fecha_inicio">
          <Input id="fecha_inicio" name="fecha_inicio" type="date" defaultValue={expediente?.fecha_inicio ?? ""} />
        </Field>
        <Field label="Responsable">
          <NativeSelect key={miembros.length} name="responsable_id" defaultValue={expediente?.responsable_id ?? user.id}>
            <option value="">Sin asignar</option>
            {miembros.map((mb) => (
              <option key={mb.user_id} value={mb.user_id}>
                {mb.perfil?.nombre_completo || mb.perfil?.email}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Descripción / pretensión" htmlFor="descripcion">
        <Textarea id="descripcion" name="descripcion" rows={3} defaultValue={expediente?.descripcion ?? ""} />
      </Field>
    </FormDialog>
  );
}
