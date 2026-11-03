import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, MailOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invitacionesPendientesQuery, membresiasQuery } from "@/lib/queries";
import { DEPARTAMENTOS, validarRUC } from "@/lib/peru";
import { setEstudioPreferido } from "@/hooks/use-estudio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect, formValues } from "@/components/app/ui";
import { Logo } from "@/components/app/Logo";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Configure su estudio — Kevelegal" },
      { name: "description", content: "Cree su estudio jurídico o acepte una invitación en Kevelegal." },
      { property: "og:title", content: "Configure su estudio — Kevelegal" },
      { property: "og:description", content: "Primeros pasos en Kevelegal." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const { data: invitaciones = [] } = useQuery(invitacionesPendientesQuery());
  const { data: membresias = [] } = useQuery(membresiasQuery());
  const [saving, setSaving] = useState(false);
  const [rucError, setRucError] = useState<string | null>(null);

  async function entrar(estudioId: string) {
    setEstudioPreferido(estudioId);
    await qc.invalidateQueries({ queryKey: ["membresias"] });
    navigate({ to: "/dashboard", replace: true });
  }

  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    if (v.ruc && !validarRUC(v.ruc)) {
      setRucError("RUC inválido");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("crear_estudio", {
      _nombre: v.nombre ?? "",
      ...(v.ruc ? { _ruc: v.ruc } : {}),
      ...(v.departamento ? { _departamento: v.departamento } : {}),
    });
    setSaving(false);
    if (error) return void toast.error(error.message);
    toast.success("Estudio creado");
    await entrar(data as string);
  }

  async function aceptar(id: string) {
    const { data, error } = await supabase.rpc("aceptar_invitacion", { _invitacion: id });
    if (error) return void toast.error(error.message);
    toast.success("Se unió al estudio");
    await entrar(data as string);
  }

  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Logo />
        <h1 className="mt-12 text-4xl font-semibold">Bienvenido a Kevelegal</h1>
        <p className="mt-2 text-muted-foreground">
          Sesión iniciada como {user.email}. Cree su estudio o únase a uno que lo haya invitado.
        </p>

        {invitaciones.length > 0 && (
          <div className="mt-10 grid gap-3">
            <h2 className="flex items-center gap-2 font-sans text-sm font-semibold uppercase tracking-wide text-primary">
              <MailOpen className="size-4" /> Invitaciones pendientes
            </h2>
            {invitaciones.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between rounded-xl border border-primary/40 bg-card p-4"
              >
                <div>
                  <p className="font-medium">Invitación como {i.rol}</p>
                  <p className="text-sm text-muted-foreground">Para {i.email}</p>
                </div>
                <Button variant="hero" onClick={() => aceptar(i.id)}>
                  Aceptar
                </Button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={crear} className="mt-10 grid gap-5 rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="flex items-center gap-2 font-sans text-sm font-semibold uppercase tracking-wide">
            <Building2 className="size-4 text-primary" /> Crear un estudio nuevo
          </h2>
          <Field label="Nombre del estudio" htmlFor="nombre">
            <Input id="nombre" name="nombre" required placeholder="Estudio Jurídico Pérez & Asociados" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="RUC (opcional)" htmlFor="ruc" error={rucError}>
              <Input id="ruc" name="ruc" inputMode="numeric" maxLength={11} onChange={() => setRucError(null)} />
            </Field>
            <Field label="Departamento" htmlFor="departamento">
              <NativeSelect id="departamento" name="departamento" defaultValue="Lima">
                {DEPARTAMENTOS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            {membresias.length > 0 && (
              <Button type="button" variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>
                Volver a mi estudio
              </Button>
            )}
            <Button type="submit" variant="hero" disabled={saving}>
              {saving ? "Creando…" : "Crear estudio"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
