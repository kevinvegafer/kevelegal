import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEstudio } from "@/hooks/use-estudio";
import { cuotasQuery } from "@/lib/queries-tiempo";
import { clientesQuery, honorariosQuery, nombreCliente, type Honorario } from "@/lib/queries";
import { estadoCuotas, generarCuotas, hoyLima } from "@/lib/cobranza";
import { formatSoles } from "@/lib/peru";
import { mensajeError } from "@/lib/errors";
import { Field, FormDialog, NativeSelect, Panel, Stat } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";
function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["cuotas"] });
    void qc.invalidateQueries({ queryKey: ["honorarios"] });
  };
}
export function PlanCuotas({ honorario, pagado }: { honorario: Honorario; pagado: number }) {
  const { estudioId, puedeVerFinanzas } = useEstudio();
  const invalidar = useInvalidar();
  const q = useQuery({ ...cuotasQuery(estudioId), enabled: puedeVerFinanzas });
  const [open, setOpen] = useState(false),
    [edit, setEdit] = useState<Tables<"cuotas"> | null>(null);
  const cuotas = (q.data ?? []).filter((c) => c.honorario_id === honorario.id);
  const m = useMutation({
    mutationFn: async (v: FormData) => {
      if (edit) {
        const monto = Number(v.get("monto"));
        if (!Number.isFinite(monto) || monto <= 0) throw new Error("Monto inválido");
        if (
          Math.round(
            (cuotas.filter((c) => c.id !== edit.id).reduce((s, c) => s + c.monto, 0) + monto) * 100,
          ) !== Math.round(honorario.monto_total * 100)
        )
          throw new Error(
            "El plan debe sumar el monto del acuerdo. Regenere el plan para redistribuir.",
          );
        const { error } = await supabase
          .from("cuotas")
          .update({ monto, fecha_vencimiento: String(v.get("fecha")) })
          .eq("estudio_id", estudioId)
          .eq("id", edit.id);
        if (error) throw error;
      } else {
        if (cuotas.length) throw new Error("Elimine el plan actual antes de generar otro");
        const nuevas = generarCuotas(
          honorario.monto_total,
          Number(v.get("numero")),
          String(v.get("fecha")),
          v.get("frecuencia") === "quincenal" ? "quincenal" : "mensual",
        );
        const { error } = await supabase
          .from("cuotas")
          .insert(nuevas.map((c) => ({ ...c, estudio_id: estudioId, honorario_id: honorario.id })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidar();
      setOpen(false);
      setEdit(null);
      toast.success("Plan actualizado");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });
  const del = useMutation({
    mutationFn: async (id?: string) => {
      let req = supabase
        .from("cuotas")
        .delete()
        .eq("estudio_id", estudioId)
        .eq("honorario_id", honorario.id);
      if (id) req = req.eq("id", id);
      const { error } = await req;
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e) => toast.error(mensajeError(e)),
  });
  if (!puedeVerFinanzas) return null;
  return (
    <div className="my-4 border-t border-border pt-4">
      <h3 className="font-display text-lg">Plan de cuotas</h3>
      {q.isError && <p role="alert">{mensajeError(q.error)}</p>}
      {estadoCuotas(cuotas, pagado, hoyLima()).map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
          <span>
            #{c.numero} · {c.fecha_vencimiento} · {formatSoles(c.monto, honorario.moneda)} · Saldo{" "}
            {formatSoles(c.saldo, honorario.moneda)}
          </span>
          <Badge
            variant={
              c.estado === "pagada"
                ? "success"
                : c.estado === "vencida"
                  ? "destructive"
                  : "secondary"
            }
          >
            {c.estado}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEdit(c);
              setOpen(true);
            }}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={del.isPending}
            onClick={() => {
              if (confirm("¿Eliminar esta cuota? El plan quedará incompleto hasta regenerarlo."))
                del.mutate(c.id);
            }}
          >
            Eliminar
          </Button>
        </div>
      ))}
      {!!cuotas.length &&
        Math.round(cuotas.reduce((s, c) => s + c.monto, 0) * 100) !==
          Math.round(honorario.monto_total * 100) && (
          <p role="alert" className="text-destructive">
            El plan no coincide con el monto del acuerdo.
          </p>
        )}
      <Button
        size="sm"
        variant="outline"
        disabled={q.isPending || !!cuotas.length}
        onClick={() => {
          setEdit(null);
          setOpen(true);
        }}
      >
        Generar cuotas
      </Button>
      {!!cuotas.length && (
        <Button
          size="sm"
          variant="ghost"
          disabled={del.isPending}
          onClick={() => {
            if (confirm("¿Eliminar todo el plan? No elimina pagos ni el acuerdo."))
              del.mutate(undefined);
          }}
        >
          Eliminar plan
        </Button>
      )}
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={edit ? "Editar cuota" : "Generar plan de cuotas"}
        submitting={m.isPending}
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate(new FormData(e.currentTarget));
        }}
      >
        <div key={edit?.id ?? "nuevo"} className="grid gap-4">
          {edit ? (
            <Field label="Monto">
              <Input
                name="monto"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={edit.monto}
              />
            </Field>
          ) : (
            <>
              <Field label="Número de cuotas">
                <Input name="numero" type="number" min="1" max="360" defaultValue="3" required />
              </Field>
              <Field label="Frecuencia">
                <NativeSelect name="frecuencia">
                  <option value="mensual">Mensual</option>
                  <option value="quincenal">Quincenal (15 días)</option>
                </NativeSelect>
              </Field>
            </>
          )}
          <Field label={edit ? "Vencimiento" : "Primer vencimiento"}>
            <Input
              name="fecha"
              type="date"
              required
              defaultValue={edit?.fecha_vencimiento ?? hoyLima()}
            />
          </Field>
        </div>
      </FormDialog>
    </div>
  );
}
export function MorososPanel() {
  const { estudioId, user, puedeVerFinanzas } = useEstudio();
  const hq = useQuery({ ...honorariosQuery(estudioId), enabled: puedeVerFinanzas });
  const cq = useQuery({ ...cuotasQuery(estudioId), enabled: puedeVerFinanzas });
  const pendientes = (hq.data ?? []).flatMap((h) =>
    estadoCuotas(
      (cq.data ?? []).filter((c) => c.honorario_id === h.id),
      h.pagos.reduce((s, p) => s + p.monto, 0),
      hoyLima(),
    )
      .filter((c) => c.estado === "vencida")
      .map((c) => ({ h, c })),
  );
  const grupos = Array.from(new Set(pendientes.map((p) => p.h.cliente_id))).map((id) => {
    const items = pendientes.filter((p) => p.h.cliente_id === id),
      h = items[0]!.h;
    return {
      id,
      cliente: h.cliente,
      items,
      cuerpo: `Estimado/a ${nombreCliente(h.cliente)}, le recordamos sus cuotas vencidas: ${items.map(({ h, c }) => `${h.concepto}, cuota ${c.numero}: saldo ${formatSoles(c.saldo, h.moneda)}, vencimiento ${c.fecha_vencimiento}`).join("; ")}. Por favor comuníquese con el estudio para coordinar su pago. Gracias.`,
    };
  });
  const m = useMutation({
    mutationFn: async (ids: string[]) => {
      const rows = grupos
        .filter((g) => ids.includes(g.id))
        .map((g) => ({
          estudio_id: estudioId,
          cliente_id: g.id,
          autor: "estudio",
          autor_id: user.id,
          cuerpo: g.cuerpo,
        }));
      if (!rows.length) return;
      const { error } = await supabase.from("mensajes_cliente").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Recordatorios publicados en el portal"),
    onError: (e) => toast.error(mensajeError(e)),
  });
  if (!puedeVerFinanzas) return null;
  return (
    <div className="space-y-4 my-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {["PEN", "USD"].map((moneda) => (
          <Stat
            key={moneda}
            label={`Saldo vencido (${moneda})`}
            value={formatSoles(
              pendientes.filter((p) => p.h.moneda === moneda).reduce((s, p) => s + p.c.saldo, 0),
              moneda,
            )}
          />
        ))}
      </div>
      <Panel
        title="Morosos"
        action={
          <Button
            size="sm"
            disabled={m.isPending || !grupos.length}
            onClick={() => {
              if (confirm(`¿Avisar a ${grupos.length} clientes en el portal?`))
                m.mutate(grupos.map((g) => g.id));
            }}
          >
            Recordar a todos en el portal
          </Button>
        }
      >
        {(hq.isPending || cq.isPending) && <p>Cargando cobranza…</p>}
        {(hq.isError || cq.isError) && <p role="alert">{mensajeError(hq.error ?? cq.error)}</p>}
        {!grupos.length && !hq.isPending && !cq.isPending && !hq.isError && !cq.isError && (
          <p className="text-muted-foreground">Sin cuotas vencidas.</p>
        )}
        {grupos.map((g) => {
          const digits = (g.cliente?.telefono ?? "").replace(/\D/g, "").replace(/^00/, "");
          const telefono = digits.length === 9 ? "51" + digits : digits;
          return (
            <div key={g.id} className="border-b border-border py-3">
              <p className="font-medium">{nombreCliente(g.cliente)}</p>
              <p className="text-sm text-muted-foreground">
                {g.items
                  .map(({ h, c }) => `${formatSoles(c.saldo, h.moneda)} (${c.fecha_vencimiento})`)
                  .join(" · ")}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {telefono && (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={`https://wa.me/${telefono}?text=${encodeURIComponent(g.cuerpo)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Recordar por WhatsApp
                    </a>
                  </Button>
                )}
                {g.cliente?.email && (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={`mailto:${g.cliente.email}?subject=${encodeURIComponent("Recordatorio de pago — Kevelegal")}&body=${encodeURIComponent(g.cuerpo)}`}
                    >
                      Recordar por correo
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={m.isPending}
                  onClick={() => m.mutate([g.id])}
                >
                  Avisar en el portal
                </Button>
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
export function FacturacionMasiva() {
  const { estudioId, puedeVerFinanzas } = useEstudio();
  const invalidar = useInvalidar();
  const [open, setOpen] = useState(false),
    [ids, setIds] = useState<string[]>([]);
  const { data: clientes = [] } = useQuery({
    ...clientesQuery(estudioId),
    enabled: open && puedeVerFinanzas,
  });
  const m = useMutation({
    mutationFn: async (v: FormData) => {
      if (!ids.length) throw new Error("Seleccione al menos un cliente");
      const monto = Number(v.get("monto")),
        n = Number(v.get("cuotas")),
        fecha = String(v.get("fecha")),
        concepto = String(v.get("concepto") ?? "").trim();
      if (!concepto || !Number.isFinite(monto) || monto <= 0)
        throw new Error("Ingrese concepto y monto válido");
      const plan = n ? generarCuotas(monto, n, fecha, "mensual") : [];
      const nuevos = ids.map((cliente_id) => ({
        id: crypto.randomUUID(),
        estudio_id: estudioId,
        cliente_id,
        concepto,
        monto_total: monto,
        modalidad: String(v.get("modalidad")),
        moneda: String(v.get("moneda")),
        fecha,
      }));
      const { error } = await supabase.from("honorarios").insert(nuevos);
      if (error) throw error;
      if (plan.length) {
        const { error: cuotaError } = await supabase
          .from("cuotas")
          .insert(
            nuevos.flatMap((h) =>
              plan.map((c) => ({ ...c, estudio_id: estudioId, honorario_id: h.id })),
            ),
          );
        if (cuotaError) {
          invalidar();
          setOpen(false);
          throw new Error(
            "Los acuerdos fueron creados, pero falló el plan de cuotas. No repita la facturación: genere los planes desde cada acuerdo.",
          );
        }
      }
    },
    onSuccess: () => {
      invalidar();
      setOpen(false);
      setIds([]);
      toast.success("Acuerdos creados");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });
  if (!puedeVerFinanzas) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Facturación masiva
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Facturación masiva"
        submitting={m.isPending}
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate(new FormData(e.currentTarget));
        }}
      >
        <Field label="Concepto">
          <Input name="concepto" required />
        </Field>
        <Field label="Modalidad">
          <NativeSelect name="modalidad" defaultValue="iguala">
            <option value="iguala">Iguala</option>
            <option value="fijo">Fijo</option>
            <option value="por_hora">Por hora</option>
            <option value="mixto">Mixto</option>
            <option value="cuota_litis">Cuota litis</option>
          </NativeSelect>
        </Field>
        <Field label="Monto por cliente">
          <Input name="monto" type="number" min="0.01" step="0.01" required />
        </Field>
        <Field label="Moneda">
          <NativeSelect name="moneda">
            <option value="PEN">Soles</option>
            <option value="USD">Dólares</option>
          </NativeSelect>
        </Field>
        <Field label="Fecha y primer vencimiento">
          <Input name="fecha" type="date" defaultValue={hoyLima()} required />
        </Field>
        <Field label="Cuotas mensuales (0 = sin plan)">
          <Input name="cuotas" type="number" min="0" max="360" step="1" defaultValue="0" required />
        </Field>
        <fieldset className="grid gap-2 max-h-52 overflow-auto">
          <legend>Clientes</legend>
          {clientes.map((c) => (
            <label key={c.id} className="flex gap-2">
              <input
                type="checkbox"
                checked={ids.includes(c.id)}
                onChange={(e) =>
                  setIds((s) => (e.target.checked ? [...s, c.id] : s.filter((id) => id !== c.id)))
                }
              />
              {nombreCliente(c)}
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-muted-foreground">
          Se crean acuerdos y luego cuotas en dos operaciones. Si falla la segunda, conserve los
          acuerdos y complete sus planes individualmente.
        </p>
      </FormDialog>
    </>
  );
}
