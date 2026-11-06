import * as React from "react";
import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NumeroAnimado } from "./graficos-base";

export { useCountUp, NumeroAnimado, PALETA } from "./graficos-base";

/* ------------------------------------------------------------------ */
/* Charts load in the background so the page shows instantly          */
/* ------------------------------------------------------------------ */

let cargaGraficos: Promise<typeof import("./graficos-recharts")> | undefined;
const cargarGraficos = () => (cargaGraficos ??= import("./graficos-recharts"));

const Sparkline = React.lazy(() => cargarGraficos().then((m) => ({ default: m.Sparkline })));
const MedidorLazy = React.lazy(() => cargarGraficos().then((m) => ({ default: m.Medidor })));
const TendenciaLazy = React.lazy(() => cargarGraficos().then((m) => ({ default: m.TendenciaChart })));
const DonaLazy = React.lazy(() => cargarGraficos().then((m) => ({ default: m.Dona })));
const BarrasApiladasLazy = React.lazy(() => cargarGraficos().then((m) => ({ default: m.BarrasApiladas })));

function Cargando({ className }: { className: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-muted/40", className)} />;
}

export function Medidor(props: React.ComponentProps<typeof MedidorLazy>) {
  return (
    <React.Suspense fallback={<Cargando className="mx-auto size-36 shrink-0 rounded-full sm:size-40" />}>
      <MedidorLazy {...props} />
    </React.Suspense>
  );
}

export function TendenciaChart(props: React.ComponentProps<typeof TendenciaLazy>) {
  return (
    <React.Suspense fallback={<Cargando className="mt-9 h-56 w-full sm:h-72" />}>
      <TendenciaLazy {...props} />
    </React.Suspense>
  );
}

export function Dona(props: React.ComponentProps<typeof DonaLazy>) {
  return (
    <React.Suspense fallback={<Cargando className="mx-auto aspect-square w-full max-w-[230px] rounded-full" />}>
      <DonaLazy {...props} />
    </React.Suspense>
  );
}

export function BarrasApiladas(props: React.ComponentProps<typeof BarrasApiladasLazy>) {
  return (
    <React.Suspense fallback={<Cargando className={cn("w-full", props.height ?? "h-56 sm:h-64")} />}>
      <BarrasApiladasLazy {...props} />
    </React.Suspense>
  );
}

/* ------------------------------------------------------------------ */
/* Card shell                                                          */
/* ------------------------------------------------------------------ */

export function ChartCard({
  title,
  subtitle,
  action,
  className,
  children,
  style,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode | undefined;
  action?: React.ReactNode | undefined;
  className?: string | undefined;
  children: React.ReactNode;
  style?: React.CSSProperties | undefined;
}) {
  return (
    <section
      style={style}
      className={cn(
        "group/card relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card",
        "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h2 className="font-sans text-sm font-semibold tracking-wide">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="flex-1 px-2 pb-4 pt-3 sm:px-4 sm:pb-5">{children}</div>
    </section>
  );
}

/** Small segmented control used by the charts. */
export function Segmento<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <div role="tablist" className="inline-flex shrink-0 rounded-lg border border-border bg-background p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
            value === o.value
              ? "bg-gradient-primary text-primary-foreground shadow-glow"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI card with sparkline                                             */
/* ------------------------------------------------------------------ */

export function KpiCard({
  icon: Icon,
  label,
  value,
  format,
  delta,
  deltaLabel,
  invertDelta,
  serie,
  hint,
  to,
  tone = "primary",
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  format?: ((n: number) => string) | undefined;
  delta?: number | null | undefined;
  deltaLabel?: string | undefined;
  invertDelta?: boolean | undefined;
  serie: number[];
  hint?: React.ReactNode | undefined;
  to: NonNullable<LinkProps["to"]>;
  tone?: "primary" | "danger" | "success" | undefined;
  delay?: number | undefined;
}) {
  const id = React.useId().replace(/:/g, "");
  const color = tone === "danger" ? "var(--destructive)" : tone === "success" ? "var(--success)" : "var(--primary)";
  const positivo = delta != null && (invertDelta ? delta < 0 : delta > 0);
  const negativo = delta != null && (invertDelta ? delta > 0 : delta < 0);
  return (
    <Link
      to={to}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-all duration-300 sm:p-5",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow",
        "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `color-mix(in oklab, ${color} 30%, transparent)` }}
      />
      <div className="flex items-start justify-between gap-2">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl"
          style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
        >
          <Icon className="size-4" />
        </span>
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
              positivo && "bg-success/15 text-success",
              negativo && "bg-destructive/15 text-destructive",
              !positivo && !negativo && "bg-muted text-muted-foreground",
            )}
            title={deltaLabel}
          >
            {delta == null ? (
              "nuevo"
            ) : delta > 0 ? (
              <>
                <ArrowUpRight className="size-3" /> {delta}%
              </>
            ) : delta < 0 ? (
              <>
                <ArrowDownRight className="size-3" /> {Math.abs(delta)}%
              </>
            ) : (
              <>
                <Minus className="size-3" /> 0%
              </>
            )}
          </span>
        )}
      </div>
      <p className="mt-3 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
        {label}
      </p>
      <p className="mt-1 truncate font-display text-2xl font-semibold tabular-nums sm:text-3xl" style={{ color: tone === "danger" && value > 0 ? color : undefined }}>
        <NumeroAnimado value={value} format={format} />
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      <div className="-mx-1 mt-3 h-10">
        <React.Suspense fallback={null}>
          <Sparkline id={id} label={label} color={color} serie={serie} />
        </React.Suspense>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal progress bars (funnel)                                   */
/* ------------------------------------------------------------------ */

export function BarrasHorizontales({
  data,
}: {
  data: { nombre: string; valor: number; detalle?: string | undefined }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.valor));
  const [listo, setListo] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setListo(true), 60);
    return () => clearTimeout(t);
  }, []);
  return (
    <ul className="grid gap-3">
      {data.map((d, i) => (
        <li key={d.nombre} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{d.nombre}</span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground group-hover:text-foreground">
              {d.valor}
              {d.detalle ? ` · ${d.detalle}` : ""}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-primary transition-[width] duration-1000 ease-out group-hover:brightness-125"
              style={{
                width: listo ? `${Math.max(d.valor ? 4 : 0, (d.valor / max) * 100)}%` : "0%",
                transitionDelay: `${i * 70}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
