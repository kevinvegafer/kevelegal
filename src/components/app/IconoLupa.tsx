import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Ícono propio de la lupa de Kevelegal (búsqueda global).
 * PROTEGIDO: el usuario pidió que nunca se borre ni se reemplace al cambiar otras funciones.
 * Usa solo los tokens de color del tema (--primary, --primary-glow), así funciona en claro y oscuro.
 */
export function IconoLupa({ className, title }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  const aro = `lupa-aro-${id}`;
  const vidrio = `lupa-vidrio-${id}`;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-4 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      data-icono="lupa-kevelegal"
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={aro} x1="3" y1="3" x2="17" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--primary-glow)" }} />
          <stop offset="1" style={{ stopColor: "var(--primary)" }} />
        </linearGradient>
        <radialGradient id={vidrio} cx="8.5" cy="8" r="7" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--primary-glow)", stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: "var(--primary)", stopOpacity: 0.06 }} />
        </radialGradient>
      </defs>
      {/* vidrio */}
      <circle cx="10" cy="10" r="6.25" fill={`url(#${vidrio})`} />
      {/* mango */}
      <path d="M14.9 14.9 20.2 20.2" stroke={`url(#${aro})`} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M15.2 15.2 16.4 16.4" stroke="var(--background)" strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round" />
      {/* aro */}
      <circle cx="10" cy="10" r="6.25" stroke={`url(#${aro})`} strokeWidth="2.3" />
      {/* brillo del vidrio */}
      <path
        d="M6.9 9.1a3.4 3.4 0 0 1 2.4-2.4"
        stroke="currentColor"
        strokeOpacity="0.85"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* destello */}
      <path
        d="M19 2.6l.45 1.15 1.15.45-1.15.45L19 5.8l-.45-1.15-1.15-.45 1.15-.45z"
        style={{ fill: "var(--primary-glow)" }}
      />
    </svg>
  );
}
