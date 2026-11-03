import * as React from "react";
import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  Sector,
  XAxis,
  YAxis,
} from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/* ------------------------------------------------------------------ */
/* Animated number                                                     */
/* ------------------------------------------------------------------ */

export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function NumeroAnimado({ value, format }: { value: number; format?: ((n: number) => string) | undefined }) {
  const v = useCountUp(value);
  return <>{format ? format(v) : Math.round(v).toLocaleString("es-PE")}</>;
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
  const data = serie.map((v, i) => ({ i, v }));
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
        <ChartContainer config={{ v: { label, color } }} className="aspect-auto h-10 w-full">
          <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={2}
              fill={`url(#spark-${id})`}
              isAnimationActive
              animationDuration={1000}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Radial gauge                                                        */
/* ------------------------------------------------------------------ */

export function Medidor({ porcentaje, label, sub }: { porcentaje: number | null; label: string; sub: string }) {
  const valor = porcentaje ?? 0;
  const color = porcentaje == null ? "var(--muted-foreground)" : valor >= 80 ? "var(--success)" : valor >= 50 ? "var(--warning)" : "var(--destructive)";
  return (
    <div className="relative mx-auto size-36 shrink-0 sm:size-40">
      <ChartContainer config={{ v: { label, color } }} className="aspect-square size-full">
        <RadialBarChart
          data={[{ v: valor, fill: color }]}
          startAngle={90}
          endAngle={-270}
          innerRadius="78%"
          outerRadius="100%"
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="v" background cornerRadius={20} animationDuration={1200} />
        </RadialBarChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-3xl font-semibold tabular-nums">
            {porcentaje == null ? "—" : <><NumeroAnimado value={valor} />%</>}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground">{sub}</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trend area chart                                                    */
/* ------------------------------------------------------------------ */

export function TendenciaChart({
  data,
  config,
  series,
  formatoY,
  formatoTooltip,
}: {
  data: Record<string, string | number>[];
  config: ChartConfig;
  series: string[];
  formatoY?: ((n: number) => string) | undefined;
  formatoTooltip?: ((n: number) => string) | undefined;
}) {
  const id = React.useId().replace(/:/g, "");
  const [ocultas, setOcultas] = React.useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOcultas((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2 px-2">
        {series.map((k) => {
          const c = config[k];
          const off = ocultas.has(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all",
                off ? "border-border text-muted-foreground opacity-60" : "border-border bg-background",
              )}
              aria-pressed={!off}
            >
              <span className="size-2 rounded-full" style={{ background: off ? "var(--muted-foreground)" : (c?.color ?? "var(--primary)") }} />
              {c?.label}
            </button>
          );
        })}
      </div>
      <ChartContainer config={config} className="aspect-auto h-56 w-full sm:h-72">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {series.map((k) => (
              <linearGradient key={k} id={`g-${id}-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`var(--color-${k})`} stopOpacity={0.4} />
                <stop offset="100%" stopColor={`var(--color-${k})`} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={formatoY ? 52 : 28}
            tickFormatter={(v: number) => (formatoY ? formatoY(v) : String(v))}
            allowDecimals={false}
          />
          <ChartTooltip
            cursor={{ strokeDasharray: "4 4" }}
            content={
              <ChartTooltipContent
                indicator="dot"
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ background: `var(--color-${String(name)})` }} />
                      {config[String(name)]?.label}
                    </span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {formatoTooltip ? formatoTooltip(Number(value)) : Number(value).toLocaleString("es-PE")}
                    </span>
                  </div>
                )}
              />
            }
          />
          {series.map((k) =>
            ocultas.has(k) ? null : (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                stroke={`var(--color-${k})`}
                strokeWidth={2.5}
                fill={`url(#g-${id}-${k})`}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--background)" }}
                animationDuration={900}
              />
            ),
          )}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut                                                               */
/* ------------------------------------------------------------------ */

export const PALETA = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--info)",
  "var(--chart-3)",
  "var(--warning)",
  "var(--chart-5)",
];

export function Dona({
  data,
  centro,
}: {
  data: { nombre: string; valor: number }[];
  centro: string;
}) {
  const [activo, setActivo] = React.useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.valor, 0);
  const sel = activo != null ? data[activo] : undefined;
  const config: ChartConfig = Object.fromEntries(
    data.map((d, i) => [`s${i}`, { label: d.nombre, color: PALETA[i % PALETA.length] ?? "var(--primary)" }]),
  );
  return (
    <div className="@container">
    <div className="grid items-center gap-4 @md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative mx-auto aspect-square w-full max-w-[230px]">
        <ChartContainer config={config} className="aspect-square size-full">
          <PieChart>
            <Pie
              data={data}
              dataKey="valor"
              nameKey="nombre"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={data.length > 1 ? 3 : 0}
              cornerRadius={6}
              stroke="none"
              {...(activo != null ? { activeIndex: activo } : {})}
              activeShape={(p: PieSectorDataItem) => (
                <Sector {...p} outerRadius={Number(p.outerRadius ?? 0) + 8} />
              )}
              onMouseEnter={(_, i) => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              onClick={(_, i) => setActivo((a) => (a === i ? null : i))}
              animationDuration={900}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={PALETA[i % PALETA.length]}
                  fillOpacity={activo == null || activo === i ? 1 : 0.35}
                  className="cursor-pointer transition-opacity"
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div className="max-w-[60%]">
            <p className="font-display text-3xl font-semibold tabular-nums">
              {sel ? sel.valor : <NumeroAnimado value={total} />}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">{sel ? sel.nombre : centro}</p>
            {sel && total > 0 && (
              <p className="text-[11px] font-semibold text-primary">{Math.round((sel.valor / total) * 100)}%</p>
            )}
          </div>
        </div>
      </div>
      <ul className="grid gap-1">
        {data.map((d, i) => (
          <li key={d.nombre}>
            <button
              type="button"
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              onClick={() => setActivo((a) => (a === i ? null : i))}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                activo === i ? "bg-accent" : "hover:bg-muted",
              )}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: PALETA[i % PALETA.length] }} />
              <span className="min-w-0 flex-1 truncate">{d.nombre}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {d.valor} · {total ? Math.round((d.valor / total) * 100) : 0}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stacked bars with selectable column                                 */
/* ------------------------------------------------------------------ */

export function BarrasApiladas({
  data,
  config,
  series,
  seleccion,
  onSeleccion,
  apilar = true,
  height = "h-56 sm:h-64",
}: {
  data: Record<string, string | number>[];
  config: ChartConfig;
  series: string[];
  seleccion?: number | null | undefined;
  onSeleccion?: ((i: number | null) => void) | undefined;
  apilar?: boolean | undefined;
  height?: string | undefined;
}) {
  return (
    <ChartContainer config={config} className={cn("aspect-auto w-full", height)}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 6, left: 0, bottom: 0 }}
        onClick={(s) => {
          if (!onSeleccion) return;
          const i = s?.activeTooltipIndex;
          if (typeof i === "number") onSeleccion(seleccion === i ? null : i);
        }}
        className={onSeleccion ? "cursor-pointer" : ""}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tickMargin={8} minTickGap={10} />
        <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
        <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent indicator="dot" />} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((k, si) => (
          <Bar
            key={k}
            dataKey={k}
            {...(apilar ? { stackId: "a" } : {})}
            fill={`var(--color-${k})`}
            radius={apilar ? (si === series.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0]}
            animationDuration={800}
          >
            {data.map((_, i) => (
              <Cell key={i} fillOpacity={seleccion == null || seleccion === i ? 1 : 0.3} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
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
