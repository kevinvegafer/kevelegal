import * as React from "react";

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

export const PALETA = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--info)",
  "var(--chart-3)",
  "var(--warning)",
  "var(--chart-5)",
];
