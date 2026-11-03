import { CitasSolicitadas } from "@/components/app/CitasSolicitadas";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { eventosQuery, plazosQuery, type Evento } from "@/lib/queries";
import { esFeriado, labelOf, toISODate, TIPOS_EVENTO } from "@/lib/peru";
import { useEstudio } from "@/hooks/use-estudio";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/app/ui";
import { EventoForm } from "@/components/forms/AgendaForms";

export const Route = createFileRoute("/_authenticated/_estudio/calendario")({
  head: () => ({
    meta: [
      { title: "Calendario jurídico — Kevelegal" },
      { name: "description", content: "Audiencias, diligencias, plazos y feriados en una vista mensual." },
      { property: "og:title", content: "Calendario jurídico — Kevelegal" },
      { property: "og:description", content: "Calendario del estudio jurídico." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(eventosQuery(context.estudio.id)),
      context.queryClient.ensureQueryData(plazosQuery(context.estudio.id)),
    ]),
  component: CalendarioPage,
});

function CalendarioPage() {
  const { estudioId } = useEstudio();
  const { data: eventos } = useSuspenseQuery(eventosQuery(estudioId));
  const { data: plazos } = useSuspenseQuery(plazosQuery(estudioId));
  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  const [sel, setSel] = useState(() => new Date());
  const [nuevo, setNuevo] = useState(false);
  const [edit, setEdit] = useState<Evento | null>(null);

  const dias = eachDayOfInterval({
    start: startOfWeek(startOfMonth(mes), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(mes), { weekStartsOn: 1 }),
  });

  const eventosDe = (d: Date) => eventos.filter((e) => isSameDay(new Date(e.inicio), d));
  const plazosDe = (d: Date) => plazos.filter((p) => p.estado === "pendiente" && p.fecha_vencimiento === toISODate(d));

  const selEventos = eventosDe(sel);
  const selPlazos = plazosDe(sel);
  const selFeriado = esFeriado(sel);

  return (
    <>
      <div className="mb-6"><CitasSolicitadas /></div>
      <PageHeader
        title="Calendario"
        actions={
          <Button variant="hero" onClick={() => setNuevo(true)}>
            <Plus /> Agendar evento
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-display text-xl capitalize">{format(mes, "MMMM yyyy", { locale: es })}</h2>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setMes(startOfMonth(new Date())); setSel(new Date()); }}>
                Hoy
              </Button>
              <Button size="icon" variant="ghost" aria-label="Mes anterior" onClick={() => setMes(addMonths(mes, -1))}>
                <ChevronLeft />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Mes siguiente" onClick={() => setMes(addMonths(mes, 1))}>
                <ChevronRight />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-border text-center text-xs uppercase tracking-wide text-muted-foreground">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {dias.map((d) => {
              const evs = eventosDe(d);
              const pls = plazosDe(d);
              const fer = esFeriado(d);
              const finde = d.getDay() === 0 || d.getDay() === 6;
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSel(d)}
                  className={cn(
                    "flex min-h-24 flex-col items-stretch justify-start border-r border-b border-border p-1.5 text-left transition-colors hover:bg-accent/40 [&:nth-child(7n)]:border-r-0",
                    !isSameMonth(d, mes) && "opacity-35",
                    (finde || fer) && "bg-muted/40",
                    isSameDay(d, sel) && "ring-1 ring-primary ring-inset",
                  )}
                >
                  <span
                    className={cn(
                      "inline-grid size-6 place-items-center rounded-full text-xs",
                      isSameDay(d, new Date()) && "bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {format(d, "d")}
                  </span>
                  {fer && <p className="truncate text-[10px] text-primary">{fer.nombre}</p>}
                  <div className="mt-0.5 space-y-0.5">
                    {evs.slice(0, 2).map((e) => (
                      <p key={e.id} className="truncate rounded bg-primary/20 px-1 text-[11px] text-primary">
                        {format(new Date(e.inicio), "HH:mm")} {e.titulo}
                      </p>
                    ))}
                    {pls.slice(0, 2).map((p) => (
                      <p key={p.id} className="truncate rounded bg-destructive/15 px-1 text-[11px] text-destructive">
                        ⏱ {p.titulo}
                      </p>
                    ))}
                    {evs.length + pls.length > 4 && (
                      <p className="text-[10px] text-muted-foreground">+{evs.length + pls.length - 4} más</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Panel title={<span className="inline-block first-letter:uppercase">{format(sel, "EEEE d 'de' MMMM", { locale: es })}</span>}>
          {selFeriado && <p className="mb-3 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">Feriado: {selFeriado.nombre}</p>}
          {selEventos.length === 0 && selPlazos.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin eventos ni vencimientos.</p>
          )}
          <ul className="space-y-3">
            {selEventos.map((e) => (
              <li key={e.id}>
                <button className="w-full rounded-lg border border-border p-3 text-left hover:border-primary" onClick={() => setEdit(e)}>
                  <p className="text-xs text-primary">
                    {format(new Date(e.inicio), "HH:mm")}
                    {e.fin && ` – ${format(new Date(e.fin), "HH:mm")}`} · {labelOf(TIPOS_EVENTO, e.tipo)}
                  </p>
                  <p className="text-sm font-medium">{e.titulo}</p>
                  <p className="text-xs text-muted-foreground">{e.modalidad === "virtual" ? "Virtual" : e.lugar || "Presencial"}</p>
                </button>
                {e.expediente && (
                  <Link to="/expedientes/$id" params={{ id: e.expediente.id }} className="mt-1 block text-xs text-primary hover:underline">
                    {e.expediente.numero_expediente || e.expediente.titulo}
                  </Link>
                )}
              </li>
            ))}
            {selPlazos.map((p) => (
              <li key={p.id} className="rounded-lg border border-destructive/40 p-3">
                <p className="text-xs text-destructive">Vence plazo</p>
                <p className="text-sm font-medium">{p.titulo}</p>
                {p.expediente && (
                  <Link to="/expedientes/$id" params={{ id: p.expediente.id }} className="text-xs text-primary hover:underline">
                    {p.expediente.numero_expediente || p.expediente.titulo}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <Button className="mt-4 w-full" variant="subtle" onClick={() => setNuevo(true)}>
            <Plus /> Agendar este día
          </Button>
        </Panel>
      </div>

      {nuevo && <EventoForm open fechaInicial={toISODate(sel)} onOpenChange={setNuevo} />}
      {edit && <EventoForm open evento={edit} onOpenChange={(o) => !o && setEdit(null)} />}
    </>
  );
}
