import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Cliente } from "@/lib/queries";
import { DEPARTAMENTOS, validarDocumento } from "@/lib/peru";
import { mensajeError } from "@/lib/errors";
import { useEstudio } from "@/hooks/use-estudio";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog, NativeSelect, formValues, type FormVals } from "@/components/app/ui";

export function ClienteForm({
  open,
  onOpenChange,
  cliente,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cliente?: Cliente | null;
  onSaved?: (id: string) => void;
}) {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  const [tipoPersona, setTipoPersona] = useState(cliente?.tipo_persona ?? "natural");
  const [tipoDoc, setTipoDoc] = useState<string>(cliente?.tipo_documento ?? "DNI");
  const [docError, setDocError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: async (v: FormVals) => {
      const payload = {
        estudio_id: estudioId,
        tipo_persona: tipoPersona,
        tipo_documento: tipoDoc as Cliente["tipo_documento"],
        numero_documento: v.numero_documento ?? "",
        nombres: tipoPersona === "natural" ? v.nombres : null,
        apellidos: tipoPersona === "natural" ? v.apellidos : null,
        razon_social: tipoPersona === "juridica" ? v.razon_social : null,
        representante_legal: tipoPersona === "juridica" ? v.representante_legal : null,
        email: v.email,
        telefono: v.telefono,
        direccion: v.direccion,
        departamento: v.departamento,
        provincia: v.provincia,
        distrito: v.distrito,
        estado: v.estado ?? "activo",
        origen: v.origen,
        notas: v.notas,
      };
      if (cliente) {
        const { error } = await supabase.from("clientes").update(payload).eq("id", cliente.id);
        if (error) throw error;
        return cliente.id;
      }
      const { data, error } = await supabase.from("clientes").insert(payload).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      qc.invalidateQueries({ queryKey: ["expedientes"] });
      toast.success(cliente ? "Cliente actualizado" : "Cliente registrado");
      onOpenChange(false);
      onSaved?.(id);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const err = validarDocumento(tipoDoc, v.numero_documento ?? "");
    if (err) return void setDocError(err);
    if (tipoPersona === "natural" && !v.nombres) return void toast.error("Ingrese los nombres");
    if (tipoPersona === "juridica" && !v.razon_social) return void toast.error("Ingrese la razón social");
    m.mutate(v);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={cliente ? "Editar cliente" : "Nuevo cliente"}
      onSubmit={submit}
      submitting={m.isPending}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Tipo de persona">
          <NativeSelect
            value={tipoPersona}
            onChange={(e) => {
              setTipoPersona(e.target.value);
              setTipoDoc(e.target.value === "juridica" ? "RUC" : "DNI");
            }}
          >
            <option value="natural">Persona natural</option>
            <option value="juridica">Persona jurídica</option>
          </NativeSelect>
        </Field>
        <Field label="Documento">
          <NativeSelect value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
            <option value="DNI">DNI</option>
            <option value="RUC">RUC</option>
            <option value="CE">Carné de extranjería</option>
            <option value="PASAPORTE">Pasaporte</option>
          </NativeSelect>
        </Field>
        <Field label="Número" htmlFor="numero_documento" error={docError}>
          <Input
            id="numero_documento"
            name="numero_documento"
            required
            defaultValue={cliente?.numero_documento}
            onChange={() => setDocError(null)}
            className="font-mono"
          />
        </Field>
      </div>

      {tipoPersona === "natural" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombres" htmlFor="nombres">
            <Input id="nombres" name="nombres" defaultValue={cliente?.nombres ?? ""} />
          </Field>
          <Field label="Apellidos" htmlFor="apellidos">
            <Input id="apellidos" name="apellidos" defaultValue={cliente?.apellidos ?? ""} />
          </Field>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Razón social" htmlFor="razon_social">
            <Input id="razon_social" name="razon_social" defaultValue={cliente?.razon_social ?? ""} />
          </Field>
          <Field label="Representante legal" htmlFor="representante_legal">
            <Input
              id="representante_legal"
              name="representante_legal"
              defaultValue={cliente?.representante_legal ?? ""}
            />
          </Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Correo" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={cliente?.email ?? ""} />
        </Field>
        <Field label="Teléfono / WhatsApp" htmlFor="telefono">
          <Input id="telefono" name="telefono" defaultValue={cliente?.telefono ?? ""} placeholder="+51 9…" />
        </Field>
      </div>

      <Field label="Dirección" htmlFor="direccion">
        <Input id="direccion" name="direccion" defaultValue={cliente?.direccion ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Departamento">
          <NativeSelect name="departamento" defaultValue={cliente?.departamento ?? "Lima"}>
            {DEPARTAMENTOS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Provincia" htmlFor="provincia">
          <Input id="provincia" name="provincia" defaultValue={cliente?.provincia ?? ""} />
        </Field>
        <Field label="Distrito" htmlFor="distrito">
          <Input id="distrito" name="distrito" defaultValue={cliente?.distrito ?? ""} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Estado">
          <NativeSelect name="estado" defaultValue={cliente?.estado ?? "activo"}>
            <option value="prospecto">Prospecto</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </NativeSelect>
        </Field>
        <Field label="¿Cómo llegó?" htmlFor="origen">
          <Input id="origen" name="origen" defaultValue={cliente?.origen ?? ""} placeholder="Referido, WhatsApp, web…" />
        </Field>
      </div>
      <Field label="Notas" htmlFor="notas">
        <Textarea id="notas" name="notas" rows={3} defaultValue={cliente?.notas ?? ""} />
      </Field>
    </FormDialog>
  );
}
