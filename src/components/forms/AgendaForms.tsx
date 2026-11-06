import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/lib/demo-db/client";
import { expedientesQuery, miembrosQuery, plazosQuery, type Evento, type Plazo } from "@/lib/queries";
import { creaCiclo } from "@/lib/tareas";
import { RecordatoriosSelect } from "@/components/app/RecordatoriosSelect";
import { TIPOS_EVENTO, calcularVencimiento, parseISODate, toISODate } from "@/lib/peru";
import { mensajeError } from "@/lib/errors";
import { useEstudio } from "@/hooks/use-estudio";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialog, NativeSelect, formValues, type FormVals } from "@/components/app/ui";

function ExpedienteSelect({ defaultValue, open }: { defaultValue?: string | null | undefined; open: boolean }) {
  const { estudioId } = useEstudio();
  const { data: expedientes = [] } = useQuery({ ...expedientesQuery(estudioId), enabled: open });
  return (
    <NativeSelect key={expedientes.length} name="expediente_id" defaultValue={defaultValue ?? ""}>
      <option value="">— Sin expediente —</option>
      {expedientes.map((e) => (
        <option key={e.id} value={e.id}>
          {e.numero_expediente ? `${e.numero_expediente} · ` : ""}
          {e.titulo}
        </option>
      ))}
    </NativeSelect>
  );
}

function MiembroSelect({ name, defaultValue, open }: { name: string; defaultValue?: string | null | undefined; open: boolean }) {
  const { estudioId } = useEstudio();
  const { data: miembros = [] } = useQuery({ ...miembrosQuery(estudioId), enabled: open });
  return (
    <NativeSelect key={miembros.length} name={name} defaultValue={defaultValue ?? ""}>
      <option value="">Sin asignar</option>
      {miembros.map((m) => (
        <option key={m.user_id} value={m.user_id}>
          {m.perfil?.nombre_completo || m.perfil?.email}
        </option>
      ))}
    </NativeSelect>
  );
}

export function PlazoForm({
  open,
  onOpenChange,
  plazo,
  expedienteId,
  parentId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plazo?: Plazo | null;
  expedienteId?: string;
  parentId?: string;
}) {
  const { estudioId, user } = useEstudio();
  const qc = useQueryClient();
  const { data: todas = [] } = useQuery({ ...plazosQuery(estudioId), enabled: open });
  const madreInicial = plazo?.parent_id ?? parentId ?? "";
  const [madre, setMadre] = useState(madreInicial);
  const [dependeDe, setDependeDe] = useState(plazo?.depende_de ?? "");
  const [desfase, setDesfase] = useState(String(plazo?.desfase_dias ?? 0));
  const [tipo, setTipo] = useState(plazo?.tipo ?? (parentId ? "tarea" : "plazo_procesal"));
  const expActual = plazo?.expediente_id ?? expedienteId ?? todas.find((x) => x.id === madre)?.expediente_id ?? null;
  // Candidates: pending tasks of the same case (or without case), never itself.
  const candidatas = todas.filter(
    (x) => x.id !== plazo?.id && x.estado === "pendiente" && (x.expediente_id ?? null) === (expActual ?? null),
  );
  const [notif, setNotif] = useState(plazo?.fecha_notificacion ?? "");
  const [dias, setDias] = useState(plazo?.dias_habiles?.toString() ?? "");
  const [venc, setVenc] = useState(plazo?.fecha_vencimiento ?? "");

  const calculado = useMemo(() => {
    if (tipo !== "plazo_procesal" || !notif || !dias || Number(dias) <= 0) return null;
    return toISODate(calcularVencimiento(parseISODate(notif), Number(dias)));
  }, [tipo, notif, dias]);

  const m = useMutation({
    mutationFn: async (v: FormVals) => {
      const fecha = (tipo === "plazo_procesal" && calculado) || venc;
      if (!fecha) throw new Error("Indique la fecha de vencimiento");
      if (plazo && madre && creaCiclo(plazo.id, madre, todas, "parent_id")) throw new Error("Una tarea no puede ser subtarea de sí misma");
      if (plazo && dependeDe && creaCiclo(plazo.id, dependeDe, todas, "depende_de")) throw new Error("Esa dependencia crearía un ciclo");
      const madreRow = todas.find((x) => x.id === madre);
      const payload = {
        estudio_id: estudioId,
        expediente_id: expedienteId ?? madreRow?.expediente_id ?? v.expediente_id,
        titulo: v.titulo ?? "",
        tipo,
        parent_id: madre || null,
        depende_de: dependeDe || null,
        desfase_dias: dependeDe ? Math.max(0, Number(desfase) || 0) : 0,
        fecha_notificacion: tipo === "plazo_procesal" ? notif || null : null,
        dias_habiles: tipo === "plazo_procesal" && dias ? Number(dias) : null,
        fecha_vencimiento: fecha,
        prioridad: v.prioridad ?? "media",
        asignado_a: v.asignado_a,
        notas: v.notas,
      };
      if (plazo) {
        const { error } = await supabase.from("plazos").update(payload).eq("id", plazo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plazos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plazos"] });
      toast.success(plazo ? "Plazo actualizado" : "Plazo registrado");
      onOpenChange(false);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    if (!v.titulo) return void toast.error("Describa el plazo o tarea");
    m.mutate(v);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={plazo ? "Editar plazo" : parentId ? "Nueva subtarea" : "Nuevo plazo o tarea"}
      onSubmit={submit}
      submitting={m.isPending}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <NativeSelect value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="plazo_procesal">Plazo procesal</option>
            <option value="tarea">Tarea</option>
          </NativeSelect>
        </Field>
        <Field label="Prioridad">
          <NativeSelect name="prioridad" defaultValue={plazo?.prioridad ?? (tipo === "plazo_procesal" ? "alta" : "media")}>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Descripción" htmlFor="titulo">
        <Input
          id="titulo"
          name="titulo"
          required
          defaultValue={plazo?.titulo}
          placeholder={tipo === "plazo_procesal" ? "Apelar sentencia" : "Preparar escrito de alegatos"}
        />
      </Field>
      {!expedienteId && !madre && (
        <Field label="Expediente">
          <ExpedienteSelect open={open} defaultValue={plazo?.expediente_id} />
        </Field>
      )}

      <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
        <Field label="Subtarea de" hint="Opcional: agrupa esta tarea bajo otra.">
          <NativeSelect value={madre} onChange={(e) => setMadre(e.target.value)}>
            <option value="">— Tarea principal —</option>
            {candidatas
              .filter((x) => !x.parent_id)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.titulo}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field label="Empieza cuando se complete" hint="La fecha se moverá sola al completar la anterior.">
          <NativeSelect value={dependeDe} onChange={(e) => setDependeDe(e.target.value)}>
            <option value="">— Sin dependencia —</option>
            {candidatas.map((x) => (
              <option key={x.id} value={x.id}>
                {x.titulo}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {dependeDe && (
          <Field label="Días hábiles después" htmlFor="desfase" className="sm:col-span-2">
            <Input id="desfase" type="number" min={0} max={365} value={desfase} onChange={(e) => setDesfase(e.target.value)} />
          </Field>
        )}
      </div>

      {tipo === "plazo_procesal" ? (
        <div className="grid gap-4 rounded-lg border border-primary/30 bg-accent/40 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha de notificación" htmlFor="notif">
              <Input id="notif" type="date" value={notif} onChange={(e) => setNotif(e.target.value)} required />
            </Field>
            <Field label="Días hábiles" htmlFor="dias">
              <Input
                id="dias"
                type="number"
                min={1}
                max={365}
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                required
              />
            </Field>
          </div>
          <p className="text-sm">
            {calculado ? (
              <>
                Vence el{" "}
                <strong className="text-primary">
                  {format(parseISODate(calculado), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
                </strong>
                <span className="block text-xs text-muted-foreground">
                  Se cuenta desde el día siguiente a la notificación, sin sábados, domingos ni feriados
                  nacionales. Verifique días inhábiles locales o suspensiones del despacho.
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Ingrese la notificación y los días para calcular.</span>
            )}
          </p>
        </div>
      ) : (
        <Field label="Fecha límite" htmlFor="venc">
          <Input id="venc" type="date" value={venc} onChange={(e) => setVenc(e.target.value)} required />
        </Field>
      )}

      <Field label="Asignado a">
        <MiembroSelect name="asignado_a" open={open} defaultValue={plazo?.asignado_a ?? user.id} />
      </Field>
      <Field label="Notas" htmlFor="notas">
        <Textarea id="notas" name="notas" rows={2} defaultValue={plazo?.notas ?? ""} />
      </Field>
    </FormDialog>
  );
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventoForm({
  open,
  onOpenChange,
  evento,
  expedienteId,
  fechaInicial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  evento?: Evento | null;
  expedienteId?: string;
  fechaInicial?: string;
}) {
  const { estudioId, user } = useEstudio();
  const qc = useQueryClient();
  const [modalidad, setModalidad] = useState(evento?.modalidad ?? "presencial");
  const [tipoEvento, setTipoEvento] = useState(evento?.tipo ?? "audiencia");
  const [recordatorios, setRecordatorios] = useState<number[] | null>(evento?.recordatorios ?? null);

  const m = useMutation({
    mutationFn: async (v: FormVals) => {
      if (!v.inicio) throw new Error("Indique fecha y hora");
      const inicio = new Date(v.inicio);
      const fin = v.fin ? new Date(v.fin) : null;
      if (fin && fin < inicio) throw new Error("La hora de fin debe ser posterior al inicio");
      const payload = {
        estudio_id: estudioId,
        expediente_id: expedienteId ?? v.expediente_id,
        titulo: v.titulo ?? "",
        tipo: tipoEvento,
        recordatorios,
        inicio: inicio.toISOString(),
        fin: fin?.toISOString() ?? null,
        modalidad,
        lugar: modalidad === "presencial" ? v.lugar : null,
        enlace: modalidad === "virtual" ? v.enlace : null,
        responsable_id: v.responsable_id,
        notas: v.notas,
      };
      if (evento) {
        const { error } = await supabase.from("eventos").update(payload).eq("id", evento.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("eventos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventos"] });
      qc.invalidateQueries({ queryKey: ["avisos"] });
      toast.success(evento ? "Evento actualizado" : "Evento agendado");
      onOpenChange(false);
    },
    onError: (e) => toast.error(mensajeError(e)),
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    if (!v.titulo) return void toast.error("Ingrese un título");
    m.mutate(v);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={evento ? "Editar evento" : "Agendar audiencia o evento"}
      onSubmit={submit}
      submitting={m.isPending}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <NativeSelect value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)}>
            {TIPOS_EVENTO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Modalidad">
          <NativeSelect value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
            <option value="presencial">Presencial</option>
            <option value="virtual">Virtual (Google Meet / Zoom)</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Título" htmlFor="titulo">
        <Input
          id="titulo"
          name="titulo"
          required
          defaultValue={evento?.titulo}
          placeholder="Audiencia única"
        />
      </Field>
      {!expedienteId && (
        <Field label="Expediente">
          <ExpedienteSelect open={open} defaultValue={evento?.expediente_id} />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Inicio" htmlFor="inicio">
          <Input
            id="inicio"
            name="inicio"
            type="datetime-local"
            required
            defaultValue={toLocalInput(evento?.inicio) || (fechaInicial ? `${fechaInicial}T09:00` : "")}
          />
        </Field>
        <Field label="Fin (opcional)" htmlFor="fin">
          <Input id="fin" name="fin" type="datetime-local" defaultValue={toLocalInput(evento?.fin)} />
        </Field>
      </div>
      {modalidad === "presencial" ? (
        <Field label="Lugar" htmlFor="lugar">
          <Input id="lugar" name="lugar" defaultValue={evento?.lugar ?? ""} placeholder="Sala 3, Sede Alzamora Valdez" />
        </Field>
      ) : (
        <Field label="Enlace de la sesión" htmlFor="enlace">
          <Input id="enlace" name="enlace" type="url" defaultValue={evento?.enlace ?? ""} placeholder="https://meet.google.com/…" />
        </Field>
      )}
      <Field label="Responsable">
        <MiembroSelect name="responsable_id" open={open} defaultValue={evento?.responsable_id ?? user.id} />
      </Field>
      <Field label="Recordatorios">
        <RecordatoriosSelect value={recordatorios} onChange={setRecordatorios} tipo={tipoEvento} />
      </Field>
      <Field label="Notas" htmlFor="notas">
        <Textarea id="notas" name="notas" rows={2} defaultValue={evento?.notas ?? ""} />
      </Field>
    </FormDialog>
  );
}
