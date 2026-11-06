import * as React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
NativeSelect.displayName = "NativeSelect";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor?: string | undefined;
  hint?: string | undefined;
  error?: string | null | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold break-words sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 [&>*]:max-w-full">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-accent">
        <Icon className="size-5 text-primary" />
      </div>
      <h3 className="mt-4 font-sans text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Panel({
  title,
  action,
  className,
  children,
}: {
  title?: ReactNode | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-card shadow-card", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <h2 className="min-w-0 font-sans text-sm font-semibold tracking-wide">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitting,
  submitLabel = "Guardar",
  wide,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string | undefined;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitting?: boolean | undefined;
  submitLabel?: string | undefined;
  wide?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
        <form onSubmit={onSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="hero" disabled={submitting}>
              {submitting ? "Guardando…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode | undefined;
  tone?: "default" | "primary" | "danger" | undefined;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "mt-2 font-display text-3xl font-semibold",
          tone === "primary" && "text-primary",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export type CampoForm =
  | "numero_documento" | "nombres" | "apellidos" | "razon_social" | "representante_legal" | "email" | "telefono" | "direccion" | "departamento" | "provincia" | "distrito" | "estado" | "origen" | "notas" | "titulo" | "cliente_id" | "numero_expediente" | "materia" | "via" | "tipo_proceso" | "distrito_judicial" | "organo_jurisdiccional" | "juez" | "especialista" | "etapa" | "cuantia" | "fecha_inicio" | "responsable_id" | "descripcion" | "expediente_id" | "prioridad" | "asignado_a" | "inicio" | "fin" | "tipo" | "lugar" | "enlace" | "concepto" | "modalidad" | "monto_total" | "moneda" | "fecha" | "monto" | "metodo" | "tipo_comprobante" | "numero_comprobante" | "categoria" | "reembolsable" | "nombre" | "rol" | "es_cliente" | "abogado" | "ruc" | "nombre_completo" | "colegiatura";

export type FormVals = Readonly<Record<CampoForm, string | null>>;

/** Read a form into an object of trimmed values; empty or missing fields are null. */
export function formValues(form: HTMLFormElement): FormVals {
  const fd = new FormData(form);
  const out = new Map<string, string | null>();
  fd.forEach((v, k) => {
    const s = typeof v === "string" ? v.trim() : "";
    out.set(k, s === "" ? null : s);
  });
  return new Proxy({} as FormVals, {
    get: (_t, key) => (typeof key === "string" ? (out.get(key) ?? null) : undefined),
  });
}
