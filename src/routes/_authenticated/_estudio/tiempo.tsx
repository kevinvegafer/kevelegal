import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Timer } from "lucide-react";
import { supabase } from "@/lib/demo-db/client";
import { useEstudio } from "@/hooks/use-estudio";
import { tiempoQuery, segundosActuales, type RegistroTiempo } from "@/lib/queries-tiempo";
import {
  clientesQuery,
  expedientesQuery,
  miembrosQuery,
  nombreCliente,
  nombreMiembro,
} from "@/lib/queries";
import { formatDuracion, segundosAMonto, hoyLima } from "@/lib/cobranza";
import { formatSoles } from "@/lib/peru";
import { mensajeError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormDialog, NativeSelect, PageHeader, EmptyState, Stat } from "@/components/app/ui";
import { IniciarCronometro } from "@/components/app/Cronometros";
export const Route = createFileRoute("/_authenticated/_estudio/tiempo")({
  head: () => ({
    meta: [
      { title: "Registro de tiempo — Kevelegal" },
      { name: "description", content: "Cronómetros, horas trabajadas y facturación del estudio." },
      { property: "og:title", content: "Registro de tiempo — Kevelegal" },
      { property: "og:description", content: "Controle y facture el tiempo de su equipo." },
    ],
  }),
  component: Tiempo,
});
function Tiempo() {
  const { estudioId, estudio, user, puedeVerFinanzas } = useEstudio();
  const qc = useQueryClient();
  const q = useQuery(tiempoQuery(estudioId));
  const { data: exps = [] } = useQuery(expedientesQuery(estudioId));
  const { data: clientes = [] } = useQuery(clientesQuery(estudioId));
  const { data: miembros = [] } = useQuery(miembrosQuery(estudioId));
  const [miembro, setMiembro] = useState(""),
    [exp, setExp] = useState(""),
    [estado, setEstado] = useState(""),
    [desde, setDesde] = useState(""),
    [hasta, setHasta] = useState("");
  const [form, setForm] = useState<RegistroTiempo | "nuevo" | null>(null),
    [facturar, setFacturar] = useState(false),
    [cliente, setCliente] = useState(""),
    [seleccion, setSeleccion] = useState<string[]>([]);
  const filas = (q.data ?? []).filter(
    (r) =>
      (!miembro || r.user_id === miembro) &&
      (!exp || r.expediente_id === exp) &&
      (!estado || (estado === "si" ? !!r.honorario_id : !r.honorario_id)) &&
      (!desde || r.fecha >= desde) &&
      (!hasta || r.fecha <= hasta),
  );
  const elegibles = filas.filter(
    (r) =>
      !r.en_curso &&
      !r.honorario_id &&
      r.facturable &&
      exps.some((e) => e.id === r.expediente_id && e.cliente_id === cliente),
  );
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["tiempo"] });
    void qc.invalidateQueries({ queryKey: ["honorarios"] });
  };
  const m = useMutation({
    mutationFn: async (v: FormData) => {
      if (!form) return;
      const horas = Number(v.get("horas")),
        min = Number(v.get("minutos")),
        tarifa = String(v.get("tarifa") ?? "");
      if (
        !Number.isFinite(horas) ||
        horas < 0 ||
        !Number.isInteger(min) ||
        min < 0 ||
        min > 59 ||
        horas * 3600 + min * 60 <= 0
      )
        throw new Error("Ingrese una duración válida");
      if (tarifa && (!Number.isFinite(Number(tarifa)) || Number(tarifa) < 0))
        throw new Error("Tarifa inválida");
      const payload = {
        fecha: String(v.get("fecha")),
        segundos: Math.round(horas * 3600 + min * 60),
        expediente_id: String(v.get("expediente") ?? "") || null,
        descripcion: String(v.get("descripcion") ?? "").trim(),
        facturable: v.get("facturable") === "on",
        tarifa_hora: tarifa ? Number(tarifa) : null,
      };
      if (!payload.descripcion) throw new Error("Ingrese una descripción");
      if (form === "nuevo") {
        const { error } = await supabase
          .from("registros_tiempo")
          .insert({ ...payload, estudio_id: estudioId, user_id: user.id });
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("registros_tiempo")
          .update(payload)
          .eq("estudio_id", estudioId)
          .eq("id", form.id)
          .eq("updated_at", form.updated_at)
          .eq("en_curso", false)
          .is("honorario_id", null)
          .select("id");
        if (error) throw error;
        if (!data.length) throw new Error("El registro cambió o está facturado");
      }
    },
    onSuccess: () => {
      invalidar();
      setForm(null);
      toast.success("Tiempo guardado");
    },
    onError: (e) => toast.error(mensajeError(e)),
  });
  const del = useMutation({
    mutationFn: async (r: RegistroTiempo) => {
      const { data, error } = await supabase
        .from("registros_tiempo")
        .delete()
        .eq("estudio_id", estudioId)
        .eq("id", r.id)
        .eq("updated_at", r.updated_at)
        .eq("en_curso", false)
        .is("honorario_id", null)
        .select("id");
      if (error) throw error;
      if (!data.length) throw new Error("El registro cambió");
    },
    onSuccess: invalidar,
    onError: (e) => toast.error(mensajeError(e)),
  });
  const bill = useMutation({
    mutationFn: async (concepto: string) => {
      const ids = elegibles.filter((r) => seleccion.includes(r.id)).map((r) => r.id);
      if (!cliente || !ids.length || ids.length !== seleccion.length)
        throw new Error("Seleccione horas elegibles de un solo cliente");
      const { error } = await supabase.rpc("facturar_tiempo", {
        _estudio: estudioId,
        _cliente: cliente,
        _expediente: exp || (null as unknown as string),
        _concepto: concepto,
        _registros: ids,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      setFacturar(false);
      setSeleccion([]);
      toast.success("Honorario creado", {
        action: { label: "Ver finanzas", onClick: () => window.location.assign("/finanzas") },
      });
    },
    onError: (e) => toast.error(mensajeError(e)),
  });
  const edit = form && form !== "nuevo" ? form : null;
  return (
    <>
      <PageHeader
        title="Registro de tiempo"
        description="Varios cronómetros simultáneos y entradas manuales."
        actions={
          <>
            <IniciarCronometro />
            <Button onClick={() => setForm("nuevo")}>Registro manual</Button>
            {puedeVerFinanzas && (
              <Button variant="outline" onClick={() => setFacturar(true)}>
                Facturar horas
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <Stat
          label="Horas registradas"
          value={formatDuracion(filas.reduce((s, r) => s + segundosActuales(r), 0))}
        />
        {puedeVerFinanzas && (
          <Stat
            label="Importe facturable (PEN)"
            value={formatSoles(
              filas
                .filter((r) => r.facturable)
                .reduce(
                  (s, r) =>
                    s + segundosAMonto(segundosActuales(r), r.tarifa_hora ?? estudio.tarifa_hora),
                  0,
                ),
            )}
          />
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-5 mb-4">
        <Field label="Miembro">
          <NativeSelect value={miembro} onChange={(e) => setMiembro(e.target.value)}>
            <option value="">Todos</option>
            {miembros.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {nombreMiembro(miembros, m.user_id)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Expediente">
          <NativeSelect value={exp} onChange={(e) => setExp(e.target.value)}>
            <option value="">Todos</option>
            {exps.map((e) => (
              <option key={e.id} value={e.id}>
                {e.titulo}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Facturado">
          <NativeSelect value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="si">Facturado</option>
            <option value="no">No facturado</option>
          </NativeSelect>
        </Field>
        <Field label="Desde">
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
      </div>
      {q.isPending && <p>Cargando…</p>}
      {q.isError && <p role="alert">{mensajeError(q.error)}</p>}
      {!q.isPending && !q.isError && !filas.length && (
        <EmptyState
          icon={Timer}
          title="Sin registros"
          description="Inicie un cronómetro o registre horas manualmente."
        />
      )}
      <div className="space-y-2">
        {filas.map((r) => (
          <div
            className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-center gap-3"
            key={r.id}
          >
            <div className="flex-1">
              <p>{r.descripcion || "Sin descripción"}</p>
              <p className="text-xs text-muted-foreground">
                {r.fecha} · {nombreMiembro(miembros, r.user_id)} ·{" "}
                {exps.find((e) => e.id === r.expediente_id)?.titulo ?? "Sin expediente"} ·{" "}
                {r.en_curso ? "En curso" : r.honorario_id ? "Facturado" : "No facturado"}
              </p>
            </div>
            <span>{formatDuracion(segundosActuales(r))}</span>
            {puedeVerFinanzas && (
              <span>
                {formatSoles(
                  segundosAMonto(segundosActuales(r), r.tarifa_hora ?? estudio.tarifa_hora),
                )}
              </span>
            )}
            {!r.honorario_id && !r.en_curso && (puedeVerFinanzas || r.user_id === user.id) && (
              <>
                <Button variant="ghost" onClick={() => setForm(r)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  disabled={del.isPending}
                  onClick={() => {
                    if (confirm("¿Eliminar registro?")) del.mutate(r);
                  }}
                >
                  Eliminar
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
      <FormDialog
        open={!!form}
        onOpenChange={(o) => {
          if (!o) setForm(null);
        }}
        title={edit ? "Editar tiempo" : "Registro manual"}
        submitting={m.isPending}
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate(new FormData(e.currentTarget));
        }}
      >
        <div key={edit?.id ?? "nuevo"} className="grid gap-4">
          <Field label="Fecha">
            <Input name="fecha" type="date" required defaultValue={edit?.fecha ?? hoyLima()} />
          </Field>
          <Field label="Horas">
            <Input
              name="horas"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={Math.floor((edit?.segundos ?? 0) / 3600)}
            />
          </Field>
          <Field label="Minutos">
            <Input
              name="minutos"
              type="number"
              min="0"
              max="59"
              step="1"
              required
              defaultValue={Math.floor(((edit?.segundos ?? 0) % 3600) / 60)}
            />
          </Field>
          <Field label="Expediente">
            <NativeSelect name="expediente" defaultValue={edit?.expediente_id ?? ""}>
              <option value="">Sin expediente</option>
              {exps.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.titulo}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Descripción">
            <Input name="descripcion" required defaultValue={edit?.descripcion ?? ""} />
          </Field>
          <label>
            <input type="checkbox" name="facturable" defaultChecked={edit?.facturable ?? true} />{" "}
            Facturable
          </label>
          <Field label={`Tarifa por hora (vacío: ${estudio.tarifa_hora})`}>
            <Input
              name="tarifa"
              type="number"
              min="0"
              step="0.01"
              defaultValue={edit?.tarifa_hora ?? ""}
            />
          </Field>
        </div>
      </FormDialog>
      <FormDialog
        open={facturar}
        onOpenChange={setFacturar}
        title="Facturar horas"
        submitting={bill.isPending}
        onSubmit={(e) => {
          e.preventDefault();
          bill.mutate(String(new FormData(e.currentTarget).get("concepto") ?? ""));
        }}
      >
        <Field label="Cliente">
          <NativeSelect
            required
            value={cliente}
            onChange={(e) => {
              setCliente(e.target.value);
              setSeleccion([]);
            }}
          >
            <option value="">Seleccione</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {nombreCliente(c)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Concepto">
          <Input required name="concepto" defaultValue="Horas trabajadas" />
        </Field>
        <p className="text-xs text-muted-foreground">
          Entradas detenidas, facturables y no facturadas de los expedientes del cliente, respetando
          los filtros actuales.
        </p>
        {elegibles.map((r) => (
          <label key={r.id} className="flex gap-2">
            <input
              type="checkbox"
              checked={seleccion.includes(r.id)}
              onChange={(e) =>
                setSeleccion((s) =>
                  e.target.checked ? [...s, r.id] : s.filter((id) => id !== r.id),
                )
              }
            />
            {r.fecha} · {r.descripcion} · {formatDuracion(r.segundos)}
          </label>
        ))}
      </FormDialog>
    </>
  );
}
