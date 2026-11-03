import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronDown,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  gastosQuery,
  honorariosQuery,
  nombreCliente,
  type ClienteMini,
  type Gasto,
  type Honorario,
  type Pago,
} from "@/lib/queries";
import {
  CATEGORIAS_GASTO,
  COMPROBANTES,
  METODOS_PAGO,
  MODALIDADES_HONORARIO,
  formatSoles,
  labelOf,
  parseISODate,
} from "@/lib/peru";
import { mensajeError } from "@/lib/errors";
import { useEstudio } from "@/hooks/use-estudio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader, Stat } from "@/components/app/ui";
import { GastoForm, HonorarioForm, PagoForm } from "@/components/forms/FinanzasForms";

import { PlanCuotas, MorososPanel, FacturacionMasiva } from "@/components/app/CobranzaPanel";

export const Route = createFileRoute("/_authenticated/_estudio/finanzas")({
  head: () => ({
    meta: [
      { title: "Honorarios y gastos — Kevelegal" },
      {
        name: "description",
        content: "Acuerdos de honorarios en soles, pagos recibidos y gastos por expediente.",
      },
      { property: "og:title", content: "Honorarios y gastos — Kevelegal" },
      { property: "og:description", content: "Control económico del estudio." },
    ],
  }),
  beforeLoad: ({ context }) => {
    if (context.rol === "asistente") throw redirect({ to: "/dashboard" });
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(honorariosQuery(context.estudio.id)),
      context.queryClient.ensureQueryData(gastosQuery(context.estudio.id)),
    ]),
  component: FinanzasPage,
});

function telefonoWhatsApp(tel?: string | null) {
  const digitos = (tel || "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length === 9) return `51${digitos}`; // celular peruano sin código de país
  return digitos.replace(/^00/, "");
}

type HonorarioConRelaciones = Honorario & {
  pagos: Pago[];
  cliente: (ClienteMini & { telefono: string | null; email: string | null }) | null;
  expediente: { id: string; titulo: string; numero_expediente: string | null } | null;
};

function textoAcuerdo(h: HonorarioConRelaciones, estudioNombre: string) {
  const pagado = h.pagos.reduce((s, p) => s + Number(p.monto), 0);
  const saldo = Number(h.monto_total) - pagado;
  const lineas = [
    `Acuerdo de honorarios — ${estudioNombre}`,
    ``,
    `Cliente: ${nombreCliente(h.cliente)}`,
    `Concepto: ${h.concepto}`,
    `Modalidad: ${labelOf(MODALIDADES_HONORARIO, h.modalidad)}`,
    h.expediente ? `Expediente: ${h.expediente.numero_expediente || h.expediente.titulo}` : null,
    `Fecha: ${format(parseISODate(h.fecha), "d 'de' MMMM 'de' yyyy", { locale: es })}`,
    `Monto total: ${formatSoles(h.monto_total, h.moneda)}`,
    `Pagado: ${formatSoles(pagado, h.moneda)}`,
    `Saldo pendiente: ${formatSoles(saldo, h.moneda)}`,
    h.notas ? `Notas: ${h.notas}` : null,
  ];
  return lineas.filter((l) => l !== null).join("\n");
}

function FinanzasPage() {
  const { estudio, estudioId, puedeEliminar } = useEstudio();
  const qc = useQueryClient();
  const { data: honorarios } = useSuspenseQuery(honorariosQuery(estudioId));
  const { data: gastos } = useSuspenseQuery(gastosQuery(estudioId));
  const [modal, setModal] = useState<null | "honorario" | "gasto">(null);
  const [editH, setEditH] = useState<Honorario | null>(null);
  const [editG, setEditG] = useState<Gasto | null>(null);
  const [pagoDe, setPagoDe] = useState<{ h: Honorario; saldo: number } | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const pen = honorarios.filter((h) => h.moneda === "PEN");
  const pactado = pen.reduce((s, h) => s + Number(h.monto_total), 0);
  const cobrado = pen.flatMap((h) => h.pagos).reduce((s, p) => s + Number(p.monto), 0);
  const ahora = new Date();
  const cobradoMes = pen
    .flatMap((h) => h.pagos)
    .filter((p) => isSameMonth(parseISODate(p.fecha), ahora))
    .reduce((s, p) => s + Number(p.monto), 0);
  const gastosMes = gastos
    .filter((g) => isSameMonth(parseISODate(g.fecha), ahora))
    .reduce((s, g) => s + Number(g.monto), 0);

  const del = useMutation({
    mutationFn: async ({ table, id }: { table: "honorarios" | "pagos" | "gastos"; id: string }) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["honorarios"] });
      qc.invalidateQueries({ queryKey: ["gastos"] });
      toast.success("Eliminado");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  return (
    <>
      <PageHeader
        title="Honorarios y gastos"
        description="Montos en soles. Los acuerdos en dólares se muestran aparte en cada fila."
        actions={
          <>
            <FacturacionMasiva />
            <Button variant="outline" onClick={() => setModal("gasto")}>
              <Plus /> Gasto
            </Button>
            <Button variant="hero" onClick={() => setModal("honorario")}>
              <Plus /> Acuerdo de honorarios
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Por cobrar"
          value={formatSoles(pactado - cobrado)}
          tone="primary"
          hint={`de ${formatSoles(pactado)} pactados`}
        />
        <Stat label="Cobrado total" value={formatSoles(cobrado)} />
        <Stat label="Cobrado este mes" value={formatSoles(cobradoMes)} />
        <Stat label="Gastos este mes" value={formatSoles(gastosMes)} />
      </div>

      <MorososPanel />

      <Tabs defaultValue="honorarios">
        <TabsList className="mb-4">
          <TabsTrigger value="honorarios">Honorarios ({honorarios.length})</TabsTrigger>
          <TabsTrigger value="gastos">Gastos ({gastos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="honorarios">
          {honorarios.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Sin acuerdos de honorarios"
              description="Registre lo pactado con cada cliente y vaya anotando sus pagos."
              action={
                <Button variant="hero" onClick={() => setModal("honorario")}>
                  <Plus /> Nuevo acuerdo
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {honorarios.map((h) => {
                const pagado = h.pagos.reduce((s, p) => s + Number(p.monto), 0);
                const total = Number(h.monto_total);
                const saldo = total - pagado;
                const pct = total > 0 ? Math.min(100, (pagado / total) * 100) : 0;
                const open = abierto === h.id;
                return (
                  <div key={h.id}>
                    <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                      <button
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        onClick={() => setAbierto(open ? null : h.id)}
                      >
                        <ChevronDown
                          className={`mt-1 size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{h.concepto}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {nombreCliente(h.cliente)} ·{" "}
                            {labelOf(MODALIDADES_HONORARIO, h.modalidad)}
                            {h.expediente &&
                              ` · ${h.expediente.numero_expediente || h.expediente.titulo}`}
                          </p>
                        </div>
                      </button>
                      <div className="w-48">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            {formatSoles(pagado, h.moneda)}
                          </span>
                          <span>{formatSoles(total, h.moneda)}</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                      {saldo <= 0 ? (
                        <Badge variant="success">Pagado</Badge>
                      ) : (
                        <Button size="sm" variant="subtle" onClick={() => setPagoDe({ h, saldo })}>
                          <Receipt /> Registrar pago
                        </Button>
                      )}
                    </div>
                    {open && (
                      <div className="border-t border-border bg-background/50 px-5 py-4 pl-12">
                        <PlanCuotas honorario={h} pagado={pagado} />
                        {h.pagos.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
                        ) : (
                          <ul className="space-y-2 text-sm">
                            {[...h.pagos]
                              .sort((a, b) => b.fecha.localeCompare(a.fecha))
                              .map((p) => (
                                <li
                                  key={p.id}
                                  className="group flex flex-wrap items-center gap-x-3"
                                >
                                  <span className="w-24 text-muted-foreground">
                                    {format(parseISODate(p.fecha), "d MMM yyyy", { locale: es })}
                                  </span>
                                  <span className="font-medium">
                                    {formatSoles(p.monto, h.moneda)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {labelOf(METODOS_PAGO, p.metodo)}
                                  </span>
                                  {p.tipo_comprobante && p.tipo_comprobante !== "ninguno" && (
                                    <span className="text-muted-foreground">
                                      {labelOf(COMPROBANTES, p.tipo_comprobante)}{" "}
                                      {p.numero_comprobante}
                                    </span>
                                  )}
                                  {p.notas && (
                                    <span className="text-xs text-muted-foreground">
                                      · {p.notas}
                                    </span>
                                  )}
                                  {puedeEliminar && (
                                    <button
                                      className="ml-auto text-xs text-destructive opacity-0 group-hover:opacity-100"
                                      onClick={() =>
                                        confirm("¿Eliminar este pago?") &&
                                        del.mutate({ table: "pagos", id: p.id })
                                      }
                                    >
                                      Eliminar
                                    </button>
                                  )}
                                </li>
                              ))}
                          </ul>
                        )}
                        {h.notas && <p className="mt-3 text-xs text-muted-foreground">{h.notas}</p>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditH(h)}>
                            <Pencil /> Editar acuerdo
                          </Button>
                          {(() => {
                            const texto = textoAcuerdo(h, estudio.nombre);
                            const wa = telefonoWhatsApp(h.cliente?.telefono);
                            return (
                              <>
                                {wa ? (
                                  <Button asChild size="sm" variant="ghost">
                                    <a
                                      href={`https://wa.me/${wa}?text=${encodeURIComponent(texto)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <MessageCircle /> Enviar por WhatsApp
                                    </a>
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      toast.error("El cliente no tiene teléfono registrado")
                                    }
                                  >
                                    <MessageCircle /> Enviar por WhatsApp
                                  </Button>
                                )}
                                {h.cliente?.email ? (
                                  <Button asChild size="sm" variant="ghost">
                                    <a
                                      href={`mailto:${h.cliente.email}?subject=${encodeURIComponent(`Acuerdo de honorarios — ${estudio.nombre}`)}&body=${encodeURIComponent(texto)}`}
                                    >
                                      <Mail /> Enviar por correo
                                    </a>
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      toast.error("El cliente no tiene correo registrado")
                                    }
                                  >
                                    <Mail /> Enviar por correo
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                          {puedeEliminar && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                confirm("¿Eliminar el acuerdo y sus pagos?") &&
                                del.mutate({ table: "honorarios", id: h.id })
                              }
                            >
                              <Trash2 /> Eliminar
                            </Button>
                          )}
                          {h.cliente && (
                            <Button asChild size="sm" variant="ghost">
                              <Link to="/clientes/$id" params={{ id: h.cliente.id }}>
                                Ver cliente
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="gastos">
          {gastos.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Sin gastos"
              description="Tasas judiciales, cédulas, notaría, SUNARP, movilidad…"
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Concepto</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Expediente</th>
                    <th className="px-4 py-3 text-right font-medium">Monto</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {gastos.map((g) => (
                    <tr key={g.id} className="group">
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(parseISODate(g.fecha), "d MMM yyyy", { locale: es })}
                      </td>
                      <td className="px-4 py-3">
                        {g.concepto}
                        <span className="block text-xs text-muted-foreground">
                          {labelOf(CATEGORIAS_GASTO, g.categoria)}
                          {g.reembolsable ? " · Reembolsable" : ""}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {g.expediente ? (
                          <Link
                            to="/expedientes/$id"
                            params={{ id: g.expediente.id }}
                            className="text-primary hover:underline"
                          >
                            {g.expediente.numero_expediente || g.expediente.titulo}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">General</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatSoles(g.monto)}</td>
                      <td className="px-2 py-3 text-right">
                        <span className="opacity-0 group-hover:opacity-100">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Editar"
                            onClick={() => setEditG(g)}
                          >
                            <Pencil />
                          </Button>
                          {puedeEliminar && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Eliminar"
                              onClick={() =>
                                confirm("¿Eliminar este gasto?") &&
                                del.mutate({ table: "gastos", id: g.id })
                              }
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {modal === "honorario" && <HonorarioForm open onOpenChange={(o) => !o && setModal(null)} />}
      {modal === "gasto" && <GastoForm open onOpenChange={(o) => !o && setModal(null)} />}
      {editH && <HonorarioForm open honorario={editH} onOpenChange={(o) => !o && setEditH(null)} />}
      {editG && <GastoForm open gasto={editG} onOpenChange={(o) => !o && setEditG(null)} />}
      {pagoDe && (
        <PagoForm
          open
          honorario={pagoDe.h}
          saldo={pagoDe.saldo}
          onOpenChange={(o) => !o && setPagoDe(null)}
        />
      )}
    </>
  );
}
