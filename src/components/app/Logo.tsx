import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Emblema de Kevelegal: balanza de la justicia con una chispa en la cima
 * (justicia + innovación). PROTEGIDO: el usuario pidió que no se reemplace.
 * Los archivos public/favicon.svg, favicon.ico, apple-touch-icon.png e icon-512.png
 * son la misma figura en colores fijos.
 */
export function LogoEmblema({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const fondo = `logo-fondo-${id}`;
  const halo = `logo-halo-${id}`;
  const oro = `logo-oro-${id}`;
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8 shrink-0", className)} aria-hidden data-logo="kevelegal">
      <defs>
        <linearGradient id={fondo} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--accent)" }} />
          <stop offset="1" style={{ stopColor: "var(--background)" }} />
        </linearGradient>
        <radialGradient id={halo} cx="32" cy="14" r="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--primary-glow)", stopOpacity: 0.42 }} />
          <stop offset="1" style={{ stopColor: "var(--primary-glow)", stopOpacity: 0 }} />
        </radialGradient>
        <linearGradient id={oro} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--accent-foreground)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--primary-glow)" }} />
          <stop offset="1" style={{ stopColor: "var(--primary)" }} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${fondo})`} />
      <rect width="64" height="64" rx="15" fill={`url(#${halo})`} />
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14.25" fill="none" style={{ stroke: "var(--primary)" }} strokeOpacity="0.3" strokeWidth="1.5" />
      <g transform="translate(32 32.5) scale(.82) translate(-32 -32)">
        <g stroke={`url(#${oro})`} strokeLinecap="round" fill="none">
          <path d="M11 25Q32 16.5 53 25" strokeWidth="4.5" />
          <path d="M32 24v22" strokeWidth="5.5" />
          <path d="M21 52h22" strokeWidth="5" />
          <path d="M11 25 6 38M11 25l5 13M53 25l-5 13M53 25l5 13" strokeWidth="2.2" />
        </g>
        <path d="M32 4.5l2.6 6.4 6.4 2.6-6.4 2.6L32 22.5l-2.6-6.4-6.4-2.6 6.4-2.6z" fill={`url(#${oro})`} />
        <path d="M3.5 38h15a7.5 7.5 0 0 1-15 0z" fill={`url(#${oro})`} />
        <path d="M45.5 38h15a7.5 7.5 0 0 1-15 0z" fill={`url(#${oro})`} />
        <path d="M28 46h8l3 6H25z" fill={`url(#${oro})`} />
      </g>
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoEmblema className="size-9 drop-shadow-[0_6px_14px_color-mix(in_oklab,var(--primary)_35%,transparent)]" />
      {!compact && (
        <span className="font-display text-xl font-semibold tracking-tight text-foreground">
          Keve<span className="text-primary">legal</span>
        </span>
      )}
    </span>
  );
}
