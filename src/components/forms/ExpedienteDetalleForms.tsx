import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Documento, Parte } from "@/lib/queries";
import { ROLES_PARTE, toISODate, validarDocumento } from "@/lib/peru";
import { mensajeError } from "@/lib/errors";
import { useEstudio } from "@/hooks/use-estudio";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field, FormDialog, NativeSelect, formValues, type FormVals } from "@/components/app/ui";

export function ParteForm({
  open,
  onOpenChange,
  expedienteId,
  parte,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expedienteId: string;
  parte?: Parte | null;
}) {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  const [tipoDoc, setTipoDoc] = useState<string>(parte?.tipo_documento ?? "DNI");
  const [docError, setDocError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: async (v: FormVals) => {
      const payload = {
        estudio_id: estudioId,
        expediente_id: expedienteId,
        nombre: v.nombre ?? "",
        rol: v.rol ?? "Tercero",
        tipo_documento: v.numero_documento ? (tipoDoc as Parte["tipo_documento"]) : null,
        numero_documento: v.numero_documento,
        abogado: v.abogado,
        es_cliente: v.es_cliente === "si",
      };
      const { error } = parte
        ? await supabase.from("partes_procesales").update(payload).eq("id", parte.id)
        : await supabase.from("partes_procesales").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partes", expedienteId] });
      toast.success("Parte guardada");
      onOpenChange(false);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={parte ? "Editar parte procesal" : "Agregar parte procesal"}
      onSubmit={(e) => {
        e.preventDefault();
        const v = formValues(e.currentTarget);
        if (!v.nombre) return void toast.error("Ingrese el nombre");
        if (v.numero_documento) {
          const err = validarDocumento(tipoDoc, v.numero_documento);
          if (err) return void setDocError(err);
        }
        m.mutate(v);
      }}
      submitting={m.isPending}
    >
      <Field label="Nombre o razón social" htmlFor="nombre">
        <Input id="nombre" name="nombre" required defaultValue={parte?.nombre} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Condición">
          <NativeSelect name="rol" defaultValue={parte?.rol ?? "Demandado"}>
            {ROLES_PARTE.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="¿Es nuestro cliente?">
          <NativeSelect name="es_cliente" defaultValue={parte?.es_cliente ? "si" : "no"}>
            <option value="no">No</option>
            <option value="si">Sí</option>
          </NativeSelect>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Documento">
          <NativeSelect value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
            <option value="DNI">DNI</option>
            <option value="RUC">RUC</option>
            <option value="CE">CE</option>
            <option value="PASAPORTE">Pasaporte</option>
          </NativeSelect>
        </Field>
        <Field label="Número (opcional)" htmlFor="numero_documento" error={docError} className="sm:col-span-2">
          <Input
            id="numero_documento"
            name="numero_documento"
            className="font-mono"
            defaultValue={parte?.numero_documento ?? ""}
            onChange={() => setDocError(null)}
          />
        </Field>
      </div>
      <Field label="Abogado de la parte" htmlFor="abogado">
        <Input id="abogado" name="abogado" defaultValue={parte?.abogado ?? ""} placeholder="Nombre y registro CAL" />
      </Field>
    </FormDialog>
  );
}

export function ActuacionForm({
  open,
  onOpenChange,
  expedienteId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expedienteId: string;
}) {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async (v: FormVals) => {
      const { error } = await supabase.from("actuaciones").insert({
        estudio_id: estudioId,
        expediente_id: expedienteId,
        fecha: v.fecha ?? toISODate(new Date()),
        tipo: v.tipo ?? "nota",
        descripcion: v.descripcion ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["actuaciones", expedienteId] });
      toast.success("Actuación registrada");
      onOpenChange(false);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar actuación"
      onSubmit={(e) => {
        e.preventDefault();
        const v = formValues(e.currentTarget);
        if (!v.descripcion) return void toast.error("Describa la actuación");
        m.mutate(v);
      }}
      submitting={m.isPending}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha" htmlFor="fecha">
          <Input id="fecha" name="fecha" type="date" defaultValue={toISODate(new Date())} />
        </Field>
        <Field label="Tipo">
          <NativeSelect name="tipo" defaultValue="resolucion">
            <option value="resolucion">Resolución notificada</option>
            <option value="escrito">Escrito presentado</option>
            <option value="audiencia">Audiencia realizada</option>
            <option value="notificacion">Notificación</option>
            <option value="nota">Nota interna</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Detalle" htmlFor="descripcion">
        <Textarea
          id="descripcion"
          name="descripcion"
          rows={4}
          required
          placeholder="Resolución N.° 5: se admite la demanda y se corre traslado por 30 días…"
        />
      </Field>
    </FormDialog>
  );
}

export function DocumentUpload({
  expedienteId,
  clienteId,
  documento,
}: {
  expedienteId: string;
  clienteId?: string | null | undefined;
  /** When set, the upload becomes a new version of this document. */
  documento?: Documento | undefined;
}) {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState(documento?.categoria ?? "escrito");
  const [subiendo, setSubiendo] = useState(false);

  async function subir(files: FileList | null) {
    if (!files?.length) return;
    setSubiendo(true);
    let ok = 0;
    try {
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name}: supera 50 MB`);
          continue;
        }
        let siguienteVersion = 1;
        const origen = documento ? (documento.documento_origen ?? documento.id) : null;
        if (origen) {
          const { data: versiones, error } = await supabase
            .from("documentos")
            .select("version")
            .eq("estudio_id", estudioId)
            .or(`id.eq.${origen},documento_origen.eq.${origen}`);
          if (error) {
            toast.error(mensajeError(error));
            continue;
          }
          siguienteVersion = Math.max(0, ...versiones.map((v) => v.version)) + 1;
        }
        const limpio = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${estudioId}/${expedienteId}/${crypto.randomUUID()}-${limpio}`;
        const up = await supabase.storage.from("documentos").upload(path, file, { contentType: file.type });
        if (up.error) {
          toast.error(`${file.name}: ${mensajeError(up.error)}`);
          continue;
        }
        const { error } = await supabase.from("documentos").insert({
          estudio_id: estudioId,
          expediente_id: expedienteId,
          cliente_id: clienteId ?? null,
          nombre: documento?.nombre ?? file.name,
          categoria,
          storage_path: path,
          mime_type: file.type || null,
          tamano: file.size,
          documento_origen: origen,
          version: siguienteVersion,
          visible_cliente: documento?.visible_cliente ?? false,
        });
        if (error) {
          await supabase.storage.from("documentos").remove([path]);
          toast.error(mensajeError(error));
          continue;
        }
        ok++;
      }
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
    if (ok) {
      toast.success(documento ? "Nueva versión subida" : ok === 1 ? "Documento subido" : `${ok} documentos subidos`);
      qc.invalidateQueries({ queryKey: ["documentos", expedienteId] });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!documento && (
        <NativeSelect value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-auto">
          <option value="escrito">Escrito</option>
          <option value="resolucion">Resolución</option>
          <option value="prueba">Medio probatorio</option>
          <option value="contrato">Contrato</option>
          <option value="poder">Poder / vigencia</option>
          <option value="otro">Otro</option>
        </NativeSelect>
      )}
      <input ref={input} type="file" multiple={!documento} className="hidden" onChange={(e) => subir(e.target.files)} />
      <Button size="sm" variant={documento ? "outline" : "subtle"} disabled={subiendo} onClick={() => input.current?.click()}>
        <Upload /> {subiendo ? "Subiendo…" : documento ? "Nueva versión" : "Subir archivos"}
      </Button>
    </div>
  );
}
