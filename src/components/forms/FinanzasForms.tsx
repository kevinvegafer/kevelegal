import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/demo-db/client";
import { clientesQuery, expedientesQuery, nombreCliente, type Gasto, type Honorario } from "@/lib/queries";
import { CATEGORIAS_GASTO, COMPROBANTES, METODOS_PAGO, MODALIDADES_HONORARIO, formatSoles, toISODate } from "@/lib/peru";
import { mensajeError } from "@/lib/errors";
import { useEstudio } from "@/hooks/use-estudio";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog, NativeSelect, formValues, type FormVals } from "@/components/app/ui";

function invalidarFinanzas(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["honorarios"] });
  qc.invalidateQueries({ queryKey: ["gastos"] });
}

export function HonorarioForm({
  open,
  onOpenChange,
  honorario,
  clienteId,
  expedienteId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  honorario?: Honorario | null;
  clienteId?: string | null;
  expedienteId?: string;
}) {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  const { data: clientes = [] } = useQuery({ ...clientesQuery(estudioId), enabled: open });
  const { data: expedientes = [] } = useQuery({ ...expedientesQuery(estudioId), enabled: open });

  const m = useMutation({
    mutationFn: async (v: FormVals) => {
      if (!v.cliente_id) throw new Error("Seleccione el cliente");
      const monto = Number(v.monto_total ?? 0);
      if (!(monto >= 0)) throw new Error("Monto inválido");
      const payload = {
        estudio_id: estudioId,
        cliente_id: v.cliente_id,
        expediente_id: v.expediente_id,
        concepto: v.concepto ?? "",
        modalidad: v.modalidad ?? "fijo",
        monto_total: monto,
        moneda: v.moneda ?? "PEN",
        fecha: v.fecha ?? toISODate(new Date()),
        notas: v.notas,
      };
      if (honorario) {
        const { error } = await supabase.from("honorarios").update(payload).eq("id", honorario.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("honorarios").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidarFinanzas(qc);
      toast.success(honorario ? "Acuerdo actualizado" : "Acuerdo de honorarios registrado");
      onOpenChange(false);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    if (!v.concepto) return void toast.error("Ingrese el concepto");
    m.mutate(v);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={honorario ? "Editar acuerdo" : "Nuevo acuerdo de honorarios"}
      onSubmit={submit}
      submitting={m.isPending}
    >
      <Field label="Cliente">
        <NativeSelect key={clientes.length} name="cliente_id" required defaultValue={honorario?.cliente_id ?? clienteId ?? ""}>
          <option value="">— Seleccione —</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {nombreCliente(c)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Expediente (opcional)">
        <NativeSelect key={expedientes.length} name="expediente_id" defaultValue={honorario?.expediente_id ?? expedienteId ?? ""}>
          <option value="">—</option>
          {expedientes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.titulo}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Concepto" htmlFor="concepto">
        <Input id="concepto" name="concepto" required defaultValue={honorario?.concepto} placeholder="Patrocinio en primera instancia" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Modalidad">
          <NativeSelect name="modalidad" defaultValue={honorario?.modalidad ?? "fijo"}>
            {MODALIDADES_HONORARIO.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Moneda">
          <NativeSelect name="moneda" defaultValue={honorario?.moneda ?? "PEN"}>
            <option value="PEN">Soles (S/)</option>
            <option value="USD">Dólares (US$)</option>
          </NativeSelect>
        </Field>
        <Field label="Monto total" htmlFor="monto_total">
          <Input id="monto_total" name="monto_total" type="number" step="0.01" min="0" required defaultValue={honorario?.monto_total ?? ""} />
        </Field>
      </div>
      <Field label="Fecha del acuerdo" htmlFor="fecha">
        <Input id="fecha" name="fecha" type="date" defaultValue={honorario?.fecha ?? toISODate(new Date())} />
      </Field>
      <Field label="Notas" htmlFor="notas">
        <Textarea id="notas" name="notas" rows={2} defaultValue={honorario?.notas ?? ""} placeholder="Cronograma de cuotas, porcentaje de cuota litis…" />
      </Field>
    </FormDialog>
  );
}

export function PagoForm({
  open,
  onOpenChange,
  honorario,
  saldo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  honorario: Pick<Honorario, "id" | "concepto" | "moneda">;
  saldo: number;
}) {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async (v: FormVals) => {
      const monto = Number(v.monto);
      if (!(monto > 0)) throw new Error("El monto debe ser mayor a cero");
      const { error } = await supabase.from("pagos").insert({
        estudio_id: estudioId,
        honorario_id: honorario.id,
        monto,
        fecha: v.fecha ?? toISODate(new Date()),
        metodo: v.metodo ?? "transferencia",
        tipo_comprobante: v.tipo_comprobante,
        numero_comprobante: v.numero_comprobante,
        notas: v.notas,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarFinanzas(qc);
      toast.success("Pago registrado");
      onOpenChange(false);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar pago"
      description={`${honorario.concepto} · Saldo pendiente ${formatSoles(saldo, honorario.moneda)}`}
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate(formValues(e.currentTarget));
      }}
      submitting={m.isPending}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Monto" htmlFor="monto">
          <Input id="monto" name="monto" type="number" step="0.01" min="0.01" required defaultValue={saldo > 0 ? saldo.toFixed(2) : ""} />
        </Field>
        <Field label="Fecha" htmlFor="fecha">
          <Input id="fecha" name="fecha" type="date" defaultValue={toISODate(new Date())} />
        </Field>
      </div>
      <Field label="Medio de pago">
        <NativeSelect name="metodo" defaultValue="transferencia">
          {METODOS_PAGO.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Comprobante">
          <NativeSelect name="tipo_comprobante" defaultValue="ninguno">
            {COMPROBANTES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="N.° de comprobante" htmlFor="numero_comprobante">
          <Input id="numero_comprobante" name="numero_comprobante" className="font-mono" placeholder="E001-123" />
        </Field>
      </div>
      <Field label="Notas" htmlFor="notas">
        <Input id="notas" name="notas" placeholder="N.° de operación, observaciones…" />
      </Field>
    </FormDialog>
  );
}

export function GastoForm({
  open,
  onOpenChange,
  gasto,
  expedienteId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  gasto?: Gasto | null;
  expedienteId?: string;
}) {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  const { data: expedientes = [] } = useQuery({ ...expedientesQuery(estudioId), enabled: open && !expedienteId });

  const m = useMutation({
    mutationFn: async (v: FormVals) => {
      const monto = Number(v.monto);
      if (!(monto > 0)) throw new Error("El monto debe ser mayor a cero");
      const payload = {
        estudio_id: estudioId,
        expediente_id: expedienteId ?? v.expediente_id,
        concepto: v.concepto ?? "",
        categoria: v.categoria ?? "otros",
        monto,
        fecha: v.fecha ?? toISODate(new Date()),
        reembolsable: v.reembolsable === "si",
        notas: v.notas,
      };
      if (gasto) {
        const { error } = await supabase.from("gastos").update(payload).eq("id", gasto.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("gastos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidarFinanzas(qc);
      toast.success("Gasto registrado");
      onOpenChange(false);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={gasto ? "Editar gasto" : "Registrar gasto"}
      onSubmit={(e) => {
        e.preventDefault();
        const v = formValues(e.currentTarget);
        if (!v.concepto) return void toast.error("Ingrese el concepto");
        m.mutate(v);
      }}
      submitting={m.isPending}
    >
      <Field label="Concepto" htmlFor="concepto">
        <Input id="concepto" name="concepto" required defaultValue={gasto?.concepto} placeholder="Arancel por ofrecimiento de pruebas" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoría">
          <NativeSelect name="categoria" defaultValue={gasto?.categoria ?? "tasas_judiciales"}>
            {CATEGORIAS_GASTO.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Monto (S/)" htmlFor="monto">
          <Input id="monto" name="monto" type="number" step="0.01" min="0.01" required defaultValue={gasto?.monto ?? ""} />
        </Field>
      </div>
      {!expedienteId && (
        <Field label="Expediente">
          <NativeSelect key={expedientes.length} name="expediente_id" defaultValue={gasto?.expediente_id ?? ""}>
            <option value="">— Gasto general del estudio —</option>
            {expedientes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.titulo}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha" htmlFor="fecha">
          <Input id="fecha" name="fecha" type="date" defaultValue={gasto?.fecha ?? toISODate(new Date())} />
        </Field>
        <Field label="¿Reembolsable por el cliente?">
          <NativeSelect name="reembolsable" defaultValue={gasto?.reembolsable === false ? "no" : "si"}>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Notas" htmlFor="notas">
        <Input id="notas" name="notas" defaultValue={gasto?.notas ?? ""} />
      </Field>
    </FormDialog>
  );
}
