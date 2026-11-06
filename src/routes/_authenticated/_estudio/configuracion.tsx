import { AgendaConfig } from "@/components/app/AgendaConfig";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/demo-db/client";
import { perfilQuery } from "@/lib/queries";
import { DEPARTAMENTOS, validarRUC } from "@/lib/peru";
import { mensajeError } from "@/lib/errors";
import { useEstudio } from "@/hooks/use-estudio";
import { CamposPersonalizadosConfig } from "@/components/app/CamposPersonalizados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect, PageHeader, Panel, formValues, type FormVals } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/_estudio/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración — Kevelegal" },
      { name: "description", content: "Datos del estudio y de su perfil profesional." },
      { property: "og:title", content: "Configuración — Kevelegal" },
      { property: "og:description", content: "Configuración del estudio." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(perfilQuery()),
  component: ConfigPage,
});

function ConfigPage() {
  const { estudio, esAdmin, user } = useEstudio();
  const qc = useQueryClient();
  const { data: perfil } = useSuspenseQuery(perfilQuery());
  const [rucError, setRucError] = useState<string | null>(null);

  const guardarEstudio = useMutation({
    mutationFn: async (v: FormVals) => {
      if (!v.nombre) throw new Error("El nombre es obligatorio");
      const { error } = await supabase
        .from("estudios")
        .update({
          nombre: v.nombre,
          ruc: v.ruc,
          direccion: v.direccion,
          departamento: v.departamento,
          provincia: v.provincia,
          distrito: v.distrito,
          telefono: v.telefono,
          email: v.email,
        })
        .eq("id", estudio.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["membresias"] });
      toast.success("Datos del estudio guardados");
      window.location.reload();
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  const guardarPerfil = useMutation({
    mutationFn: async (v: FormVals) => {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          nombre_completo: v.nombre_completo ?? "",
          colegiatura: v.colegiatura,
          telefono: v.telefono,
          email: user.email ?? null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["perfil"] });
      qc.invalidateQueries({ queryKey: ["miembros"] });
      toast.success("Perfil actualizado");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  return (
    <>
      <PageHeader title="Configuración" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Mi perfil profesional">
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              guardarPerfil.mutate(formValues(e.currentTarget));
            }}
          >
            <Field label="Nombre completo" htmlFor="nombre_completo">
              <Input id="nombre_completo" name="nombre_completo" defaultValue={perfil?.nombre_completo ?? ""} required />
            </Field>
            <Field label="Correo">
              <Input value={user.email ?? ""} disabled />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Registro de colegiatura" htmlFor="colegiatura" hint="Ej. CAL 12345">
                <Input id="colegiatura" name="colegiatura" defaultValue={perfil?.colegiatura ?? ""} />
              </Field>
              <Field label="Teléfono" htmlFor="telefono">
                <Input id="telefono" name="telefono" defaultValue={perfil?.telefono ?? ""} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="hero" disabled={guardarPerfil.isPending}>
                Guardar perfil
              </Button>
            </div>
          </form>
        </Panel>

        <Panel title="Datos del estudio">
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const v = formValues(e.currentTarget);
              if (v.ruc && !validarRUC(v.ruc)) return void setRucError("RUC inválido");
              guardarEstudio.mutate(v);
            }}
          >
            <fieldset disabled={!esAdmin} className="grid gap-4 disabled:opacity-70">
              <Field label="Nombre" htmlFor="nombre">
                <Input id="nombre" name="nombre" defaultValue={estudio.nombre} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="RUC" htmlFor="ruc" error={rucError}>
                  <Input id="ruc" name="ruc" className="font-mono" maxLength={11} defaultValue={estudio.ruc ?? ""} onChange={() => setRucError(null)} />
                </Field>
                <Field label="Teléfono" htmlFor="e-tel">
                  <Input id="e-tel" name="telefono" defaultValue={estudio.telefono ?? ""} />
                </Field>
              </div>
              <Field label="Correo del estudio" htmlFor="e-mail">
                <Input id="e-mail" name="email" type="email" defaultValue={estudio.email ?? ""} />
              </Field>
              <Field label="Dirección" htmlFor="direccion">
                <Input id="direccion" name="direccion" defaultValue={estudio.direccion ?? ""} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Departamento">
                  <NativeSelect name="departamento" defaultValue={estudio.departamento ?? "Lima"}>
                    {DEPARTAMENTOS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Provincia" htmlFor="provincia">
                  <Input id="provincia" name="provincia" defaultValue={estudio.provincia ?? ""} />
                </Field>
                <Field label="Distrito" htmlFor="distrito">
                  <Input id="distrito" name="distrito" defaultValue={estudio.distrito ?? ""} />
                </Field>
              </div>
            </fieldset>
            {esAdmin ? (
              <div className="flex justify-end">
                <Button type="submit" variant="hero" disabled={guardarEstudio.isPending}>
                  Guardar estudio
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Solo un administrador puede editar estos datos.</p>
            )}
          </form>
        </Panel>
        <CamposPersonalizadosConfig />
        <AgendaConfig />
      </div>
    </>
  );
}
