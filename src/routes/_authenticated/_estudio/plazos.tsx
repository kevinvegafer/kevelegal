import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calculator, ListChecks, Plus } from "lucide-react";
import { miembrosQuery, plazosQuery } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import { calcularVencimiento, feriadosNacionales, parseISODate, toISODate } from "@/lib/peru";
import { useEstudio } from "@/hooks/use-estudio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Field, NativeSelect, PageHeader, Panel } from "@/components/app/ui";
import { PlazoList, type PlazoConExp } from "@/components/app/PlazoList";
import { PlazoForm } from "@/components/forms/AgendaForms";

export const Route = createFileRoute("/_authenticated/_estudio/plazos")({
  head: () => ({
    meta: [
      { title: "Plazos y tareas — Kevelegal" },
      { name: "description", content: "Control de plazos procesales en días hábiles y tareas del estudio." },
      { property: "og:title", content: "Plazos y tareas — Kevelegal" },
      { property: "og:description", content: "Control de plazos procesales." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(plazosQuery(context.estudio.id)),
  component: PlazosPage,
});

function PlazosPage() {
  const { estudioId, user, puedeEliminar } = useEstudio();
  const { data: plazos } = useSuspenseQuery(plazosQuery(estudioId));
  const [vista, setVista] = useState<"pendiente" | "completado">("pendiente");
  const [tipo, setTipo] = useState("");
  const [asignado, setAsignado] = useState("");
  const { data: miembros = [] } = useQuery(miembrosQuery(estudioId));
  const [nuevo, setNuevo] = useState(false);
  const [edit, setEdit] = useState<PlazoConExp | null>(null);

  const lista = plazos
    .filter((p) => p.estado === vista && (!tipo || p.tipo === tipo) && (!asignado || (asignado === "_sin" ? !p.asignado_a : p.asignado_a === asignado)))
    .sort((a, b) =>
      vista === "pendiente"
        ? a.fecha_vencimiento.localeCompare(b.fecha_vencimiento)
        : b.fecha_vencimiento.localeCompare(a.fecha_vencimiento),
    );

  return (
    <>
      <PageHeader
        title="Plazos y tareas"
        description="Ordenados por vencimiento. Marque la casilla al cumplirlos."
        actions={
          <Button variant="hero" onClick={() => setNuevo(true)}>
            <Plus /> Nuevo plazo
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={
            <div className="flex gap-1">
              {(["pendiente", "completado"] as const).map((v) => (
                <Button key={v} size="sm" variant={vista === v ? "subtle" : "ghost"} onClick={() => setVista(v)}>
                  {v === "pendiente" ? "Pendientes" : "Completados"}
                </Button>
              ))}
            </div>
          }
          action={
            <div className="flex gap-2">
              <NativeSelect value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-8 w-auto text-xs">
                <option value="">Todos</option>
                <option value="plazo_procesal">Plazos procesales</option>
                <option value="tarea">Tareas</option>
              </NativeSelect>
              <NativeSelect value={asignado} onChange={(e) => setAsignado(e.target.value)} className="h-8 w-auto text-xs" aria-label="Asignado a">
                <option value="">Todo el equipo</option>
                <option value={user.id}>Míos</option>
                {miembros
                  .filter((m) => m.user_id !== user.id)
                  .map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.perfil?.nombre_completo || m.perfil?.email}
                    </option>
                  ))}
                <option value="_sin">Sin asignar</option>
              </NativeSelect>
            </div>
          }
        >
          <PlazoList
            plazos={lista}
            onEdit={setEdit}
            puedeEliminar={puedeEliminar}
            empty={
              <EmptyState
                icon={ListChecks}
                title={vista === "pendiente" ? "Nada pendiente" : "Sin completados"}
                description={vista === "pendiente" ? "Registre plazos procesales y Kevelegal calculará su vencimiento." : undefined}
              />
            }
          />
        </Panel>
        <div className="grid content-start gap-6">
          <Calculadora />
          <Feriados />
        </div>
      </div>

      {nuevo && <PlazoForm open onOpenChange={setNuevo} />}
      {edit && <PlazoForm open plazo={edit} onOpenChange={(o) => !o && setEdit(null)} />}
    </>
  );
}

function Calculadora() {
  const [notif, setNotif] = useState(toISODate(new Date()));
  const [dias, setDias] = useState("3");
  const r = useMemo(() => {
    if (!notif || !(Number(dias) > 0)) return null;
    return calcularVencimiento(parseISODate(notif), Number(dias));
  }, [notif, dias]);
  return (
    <Panel title={<span className="flex items-center gap-2"><Calculator className="size-4 text-primary" /> Calculadora de plazos</span>}>
      <div className="grid gap-3">
        <Field label="Notificado el" htmlFor="c-notif">
          <Input id="c-notif" type="date" value={notif} onChange={(e) => setNotif(e.target.value)} />
        </Field>
        <Field label="Días hábiles" htmlFor="c-dias">
          <Input id="c-dias" type="number" min={1} value={dias} onChange={(e) => setDias(e.target.value)} />
        </Field>
        {r && (
          <div className="rounded-lg bg-accent p-3">
            <p className="text-xs text-accent-foreground">Vence el</p>
            <p className="font-display text-xl text-primary first-letter:uppercase">
              {format(r, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Excluye sábados, domingos y feriados nacionales. No considera días inhábiles locales ni
          suspensiones de labores del Poder Judicial.
        </p>
      </div>
    </Panel>
  );
}

function Feriados() {
  const year = new Date().getFullYear();
  const [anio, setAnio] = useState(year);
  const hoy = toISODate(new Date());
  return (
    <Panel
      title="Feriados nacionales"
      action={
        <NativeSelect value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="h-8 w-auto text-xs">
          {[year, year + 1].map((y) => (
            <option key={y}>{y}</option>
          ))}
        </NativeSelect>
      }
    >
      <ul className="space-y-1.5 text-sm">
        {feriadosNacionales(anio).map((f) => (
          <li key={f.fecha} className={f.fecha < hoy ? "flex justify-between gap-2 text-muted-foreground/60" : "flex justify-between gap-2"}>
            <span className="truncate">{f.nombre}</span>
            <span className="shrink-0 text-muted-foreground">{format(parseISODate(f.fecha), "EEE d MMM", { locale: es })}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
