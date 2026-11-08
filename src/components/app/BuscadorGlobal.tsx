import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Command as CommandPrimitive } from "cmdk";
import { flushSync } from "react-dom";
import {
  memo,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckSquare,
  Clock,
  CornerDownLeft,
  FileText,
  FolderKanban,
  History,
  ListChecks,
  Loader2,
  Search,
  UsersRound,
  Users,
  X,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  buscar,
  crearIndice,
  rangosResaltado,
  type Destino,
  type Resultado,
  type TipoBusqueda,
} from "@/lib/busqueda";
import { construirEntradas } from "@/lib/busqueda-fuentes";
import { IconoLupa } from "./IconoLupa";
import { documentosEstudioQuery, partesEstudioQuery } from "@/lib/busqueda.queries";
import { clientesQuery, eventosQuery, expedientesQuery, plazosQuery } from "@/lib/queries";
import { tareasQuery } from "@/lib/mis-tareas";

/**
 * Deja los datos de búsqueda listos en memoria antes de abrir la lupa
 * (en un momento libre del navegador o al acercar el dedo/cursor al botón).
 */
export function precargarBusqueda(qc: QueryClient, estudioId: string, userId: string) {
  const st = { staleTime: 30_000 };
  void qc.prefetchQuery({ ...clientesQuery(estudioId), ...st });
  void qc.prefetchQuery({ ...expedientesQuery(estudioId), ...st });
  void qc.prefetchQuery({ ...plazosQuery(estudioId), ...st });
  void qc.prefetchQuery({ ...eventosQuery(estudioId), ...st });
  void qc.prefetchQuery({ ...tareasQuery(estudioId, userId), ...st });
  void qc.prefetchQuery({ ...documentosEstudioQuery(estudioId), ...st });
  void qc.prefetchQuery({ ...partesEstudioQuery(estudioId), ...st });
}

/** Celular: ancho de pantalla bajo 640 px (la lupa ocupa toda la pantalla). */
function useEsCelular() {
  const [cel, setCel] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const f = () => setCel(mql.matches);
    f();
    mql.addEventListener("change", f);
    return () => mql.removeEventListener("change", f);
  }, []);
  return cel;
}

/** Alto visible real (descontando el teclado del celular) mientras la lupa está abierta. */
function useAltoVisible(activo: boolean) {
  const [alto, setAlto] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!activo || !vv) return;
    let raf = 0;
    const f = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setAlto(Math.round(vv.height)));
    };
    f();
    vv.addEventListener("resize", f);
    vv.addEventListener("scroll", f);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", f);
      vv.removeEventListener("scroll", f);
    };
  }, [activo]);
  return activo ? alto : null;
}

// Estado abierto/cerrado fuera del árbol de la app: abrir la lupa no vuelve a dibujar
// el menú lateral ni la página actual, por eso aparece al instante.
// La ventana queda siempre montada (oculta): abrirla solo la muestra y enfoca el campo
// dentro del mismo toque, así el teclado del celular aparece de inmediato (también en iPhone).
let abierta = false;
let enfocar: (() => void) | null = null;
let focoPrevio: HTMLElement | null = null;
const oyentes = new Set<() => void>();
export function abrirBusqueda(v = true) {
  if (abierta === v) return;
  abierta = v;
  if (v) {
    focoPrevio = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    flushSync(() => oyentes.forEach((f) => f()));
    enfocar?.();
  } else {
    oyentes.forEach((f) => f());
    focoPrevio?.focus({ preventScroll: true });
    focoPrevio = null;
  }
}
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

/** Lupa con sus atajos (Ctrl K, "/"). Se monta una vez en el marco de la app. */
export const LupaGlobal = memo(function LupaGlobal(props: {
  estudioId: string;
  userId: string;
  paginas: PaginaBuscable[];
}) {
  const open = useSyncExternalStore(
    suscribir,
    () => abierta,
    () => false,
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        abrirBusqueda(!abierta);
        return;
      }
      // "/" abre la búsqueda cuando no se está escribiendo en un campo.
      const el = e.target as HTMLElement | null;
      const escribiendo =
        el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (e.key === "/" && !escribiendo && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        abrirBusqueda(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      abierta = false;
    };
  }, []);
  return <BuscadorGlobal {...props} open={open} onOpenChange={abrirBusqueda} />;
});

export type PaginaBuscable = { to: string; label: string; claves?: string | undefined };

const TIPOS: { tipo: TipoBusqueda; label: string; plural: string; icon: typeof Search }[] = [
  { tipo: "expediente", label: "Expediente", plural: "Expedientes", icon: FolderKanban },
  { tipo: "cliente", label: "Cliente", plural: "Clientes", icon: Users },
  { tipo: "plazo", label: "Plazo", plural: "Plazos", icon: ListChecks },
  { tipo: "tarea", label: "Tarea", plural: "Tareas", icon: CheckSquare },
  { tipo: "evento", label: "Evento", plural: "Agenda", icon: CalendarDays },
  { tipo: "documento", label: "Documento", plural: "Documentos", icon: FileText },
  { tipo: "parte", label: "Parte", plural: "Partes", icon: UsersRound },
  { tipo: "pagina", label: "Sección", plural: "Secciones", icon: Compass },
];
const INFO = Object.fromEntries(TIPOS.map((t) => [t.tipo, t])) as Record<
  TipoBusqueda,
  (typeof TIPOS)[number]
>;

const POR_GRUPO = 5;
const PAGINA = 50;
const MAX_RECIENTES = 8;

type Reciente = Pick<Resultado, "clave" | "tipo" | "titulo" | "subtitulo" | "detalle" | "destino">;

const claveRecientes = (estudioId: string) => `kevelegal.busqueda.recientes.${estudioId}`;

function leerRecientes(estudioId: string): Reciente[] {
  try {
    const raw = window.localStorage.getItem(claveRecientes(estudioId));
    const arr = raw ? (JSON.parse(raw) as Reciente[]) : [];
    return Array.isArray(arr)
      ? arr.filter((r) => r && r.clave && r.destino).slice(0, MAX_RECIENTES)
      : [];
  } catch {
    return [];
  }
}

function guardarReciente(estudioId: string, r: Reciente) {
  try {
    const lista = [r, ...leerRecientes(estudioId).filter((x) => x.clave !== r.clave)].slice(
      0,
      MAX_RECIENTES,
    );
    window.localStorage.setItem(claveRecientes(estudioId), JSON.stringify(lista));
  } catch {
    /* almacenamiento lleno o bloqueado: no es crítico */
  }
}

function hoyLima() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

function Resaltar({ texto, terminos }: { texto: string; terminos: string[] }) {
  const rangos = rangosResaltado(texto, terminos);
  if (!rangos.length) return <>{texto}</>;
  const partes: ReactNode[] = [];
  let i = 0;
  rangos.forEach(([a, b], k) => {
    if (a > i) partes.push(texto.slice(i, a));
    partes.push(
      <mark key={k} className="resaltado">
        {texto.slice(a, b)}
      </mark>,
    );
    i = b;
  });
  if (i < texto.length) partes.push(texto.slice(i));
  return <>{partes}</>;
}

const TONO = {
  primary: "primary",
  warning: "warning",
  success: "success",
  muted: "muted",
  destructive: "danger",
} as const;

export function BuscadorGlobal({
  open,
  onOpenChange,
  estudioId,
  userId,
  paginas,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  estudioId: string;
  userId: string;
  paginas: PaginaBuscable[];
}) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState<TipoBusqueda | null>(null);
  const [limite, setLimite] = useState(PAGINA);
  const [recientes, setRecientes] = useState<Reciente[]>([]);
  const consultaDiferida = useDeferredValue(texto);
  const queryClient = useQueryClient();
  const esCelular = useEsCelular();
  const altoVisible = useAltoVisible(open && esCelular);

  useEffect(() => {
    enfocar = () => inputRef.current?.focus({ preventScroll: true });
    return () => {
      enfocar = null;
    };
  }, []);

  // Sin desplazar la página de fondo mientras la lupa está abierta.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const antes = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = antes;
    };
  }, [open]);

  // Precarga en un momento libre: al abrir, el índice ya está armado.
  useEffect(() => {
    const ric = (
      window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    ).requestIdleCallback;
    const id = ric
      ? ric(() => precargarBusqueda(queryClient, estudioId, userId), { timeout: 3000 })
      : window.setTimeout(() => precargarBusqueda(queryClient, estudioId, userId), 1500);
    return () => {
      const cic = (window as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (ric && cic) cic(id);
      else window.clearTimeout(id);
    };
  }, [queryClient, estudioId, userId]);

  // Siempre leen la memoria (aunque esté cerrada, para tener el índice listo);
  // solo consultan datos nuevos cuando la lupa está abierta.
  const q = { enabled: open, staleTime: 30_000 };
  const clientes = useQuery({ ...clientesQuery(estudioId), ...q });
  const expedientes = useQuery({ ...expedientesQuery(estudioId), ...q });
  const plazos = useQuery({ ...plazosQuery(estudioId), ...q });
  const eventos = useQuery({ ...eventosQuery(estudioId), ...q });
  const tareas = useQuery({ ...tareasQuery(estudioId, userId), ...q });
  const documentos = useQuery({ ...documentosEstudioQuery(estudioId), ...q });
  const partes = useQuery({ ...partesEstudioQuery(estudioId), ...q });
  const cargando = [clientes, expedientes, plazos, eventos, tareas, documentos, partes].some(
    (r) => r.isFetching,
  );

  // El índice se reconstruye solo cuando cambian los datos, no en cada tecla.
  const indice = useMemo(
    () =>
      crearIndice(
        construirEntradas({
          hoy: hoyLima(),
          clientes: clientes.data ?? [],
          expedientes: expedientes.data ?? [],
          plazos: plazos.data ?? [],
          tareas: tareas.data ?? [],
          eventos: eventos.data ?? [],
          documentos: documentos.data ?? [],
          partes: partes.data ?? [],
          paginas,
        }),
      ),
    [
      clientes.data,
      expedientes.data,
      plazos.data,
      tareas.data,
      eventos.data,
      documentos.data,
      partes.data,
      paginas,
    ],
  );

  const respuesta = useMemo(
    () => buscar(indice, consultaDiferida, { limitePorTipo: filtro ? limite : POR_GRUPO }),
    [indice, consultaDiferida, filtro, limite],
  );
  const conteos = useMemo(
    () => new Map(respuesta.grupos.map((g) => [g.tipo, g.total])),
    [respuesta],
  );
  const visibles = filtro ? respuesta.grupos.filter((g) => g.tipo === filtro) : respuesta.grupos;
  const totalVisible = visibles.reduce((a, g) => a + g.total, 0);
  const vacia = respuesta.consulta.vacia;
  const pendiente = texto !== consultaDiferida;
  const [seleccion, setSeleccion] = useState("");

  useEffect(() => {
    if (open) {
      setRecientes(leerRecientes(estudioId));
    } else {
      setTexto("");
      setFiltro(null);
      setLimite(PAGINA);
    }
  }, [open, estudioId]);

  useEffect(() => {
    setLimite(PAGINA);
    listRef.current?.scrollTo({ top: 0 });
  }, [consultaDiferida, filtro]);

  // Los recientes que ya no existen se ocultan (cuando los datos ya cargaron).
  const recientesValidos = useMemo(() => {
    if (cargando || !indice.entradas.length) return recientes;
    const existentes = new Set(indice.entradas.map((e) => e.clave));
    return recientes.filter((r) => existentes.has(r.clave));
  }, [recientes, indice, cargando]);

  function irA(d: Destino) {
    switch (d.ruta) {
      case "/expedientes/$id":
        return navigate({
          to: "/expedientes/$id",
          params: { id: d.id },
          search: d.tab ? { tab: d.tab } : {},
        });
      case "/clientes/$id":
        return navigate({ to: "/clientes/$id", params: { id: d.id } });
      case "/calendario":
        return navigate({ to: "/calendario", search: d.dia ? { dia: d.dia } : {} });
      case "/plazos":
        return navigate({ to: "/plazos" });
      case "pagina":
        return navigate({ to: d.to as "/dashboard" });
    }
  }

  function abrir(r: Reciente) {
    guardarReciente(estudioId, {
      clave: r.clave,
      tipo: r.tipo,
      titulo: r.titulo,
      subtitulo: r.subtitulo,
      detalle: r.detalle,
      destino: r.destino,
    });
    onOpenChange(false);
    void irA(r.destino);
  }

  function borrarRecientes() {
    window.localStorage.removeItem(claveRecientes(estudioId));
    setRecientes([]);
  }

  // Al cambiar los resultados, el primero queda marcado para abrirlo con Enter.
  const primera = vacia
    ? ((filtro ? recientesValidos.filter((r) => r.tipo === filtro) : recientesValidos)[0]?.clave ??
      (!filtro || filtro === "pagina" ? `pagina:${paginas[0]?.to ?? ""}` : ""))
    : (visibles[0]?.items[0]?.clave ?? "");
  useEffect(() => {
    setSeleccion(primera);
  }, [primera, respuesta]);

  const chips: (TipoBusqueda | null)[] = [null, ...TIPOS.map((t) => t.tipo)];
  function moverFiltro(paso: number) {
    const i = chips.indexOf(filtro);
    setFiltro(chips[(i + paso + chips.length) % chips.length] ?? null);
  }

  const terminos = respuesta.consulta.terminos;

  return (
    <div className={cn("fixed inset-0 z-50", !open && "hidden")}>
      {/* Fondo sin desenfoque: es lo que más demora en dibujarse, sobre todo en celulares. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-background/80 max-sm:hidden"
        onPointerDown={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en el estudio"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onOpenChange(false);
          } else if (e.key === "Tab" && e.target !== inputRef.current) {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
        style={altoVisible ? { height: altoVisible } : undefined}
        className={cn(
          "panel-busqueda absolute flex flex-col overflow-hidden bg-popover text-popover-foreground outline-none",
          "max-sm:inset-x-0 max-sm:top-0 max-sm:h-dvh max-sm:pt-safe",
          "sm:left-1/2 sm:top-[8vh] sm:max-h-[min(44rem,84vh)] sm:w-[min(46rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-2xl sm:border sm:border-border",
        )}
      >
        <CommandPrimitive
          shouldFilter={false}
          loop
          value={seleccion}
          onValueChange={setSeleccion}
          label="Buscar en el estudio"
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* Campo de búsqueda */}
          <div className="flex items-center gap-2 border-b border-border px-3 sm:px-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground sm:hidden"
              aria-label="Cerrar búsqueda"
            >
              <ArrowLeft className="size-5" />
            </button>
            {cargando || pendiente ? (
              <Loader2
                className="size-5 shrink-0 animate-spin text-primary max-sm:hidden"
                aria-hidden
              />
            ) : (
              <IconoLupa className="size-5 text-foreground max-sm:hidden" />
            )}
            <CommandPrimitive.Input
              ref={inputRef}
              value={texto}
              onValueChange={setTexto}
              placeholder={
                esCelular
                  ? "Nombre, DNI, RUC, N.º de expediente…"
                  : "Busque nombre, DNI, RUC, N.º de expediente, plazo, documento…"
              }
              className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-[15px]"
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  moverFiltro(e.shiftKey ? -1 : 1);
                } else if (e.key === "Backspace" && !texto && filtro) {
                  setFiltro(null);
                }
              }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
            />
            {texto && (
              <button
                type="button"
                onClick={() => {
                  setTexto("");
                  inputRef.current?.focus();
                }}
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Borrar búsqueda"
              >
                <X className="size-4" />
              </button>
            )}
            <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
              Esc
            </kbd>
          </div>

          {/* Filtros por tipo */}
          <div
            className="scroll-row flex gap-1.5 border-b border-border px-3 py-2 sm:px-4"
            role="tablist"
            aria-label="Filtrar resultados"
          >
            {chips.map((t) => {
              const activo = filtro === t;
              const n = t ? conteos.get(t) : respuesta.total;
              const Icono = t ? INFO[t].icon : Search;
              return (
                <button
                  key={t ?? "todo"}
                  type="button"
                  role="tab"
                  aria-selected={activo}
                  onClick={() => {
                    setFiltro(t);
                    inputRef.current?.focus();
                  }}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors active:scale-95 sm:py-1",
                    activo
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                    !vacia && t && !n && !activo && "opacity-45",
                  )}
                >
                  <Icono className="size-3.5" />
                  {t ? INFO[t].plural : "Todo"}
                  {!vacia && n ? (
                    <span className="tabular-nums opacity-80">{n > 999 ? "999+" : n}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <CommandPrimitive.List
            ref={listRef}
            onTouchMove={() => {
              // Como en las apps nativas: al deslizar los resultados se esconde el teclado.
              if (document.activeElement === inputRef.current) inputRef.current?.blur();
            }}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 [-webkit-overflow-scrolling:touch] sm:max-h-none"
          >
            {vacia ? (
              <SinConsulta
                recientes={recientesValidos}
                paginas={paginas}
                filtro={filtro}
                onAbrir={abrir}
                onBorrar={borrarRecientes}
                onEjemplo={(t) => {
                  setTexto(t);
                  inputRef.current?.focus();
                }}
              />
            ) : (
              <>
                {respuesta.conErrores && (
                  <p className="mx-2 mb-1 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    No hay coincidencias exactas. Mostrando resultados parecidos.
                  </p>
                )}
                {visibles.length === 0 && !cargando && !pendiente && (
                  <SinResultados
                    texto={consultaDiferida}
                    filtro={filtro}
                    onQuitarFiltro={() => setFiltro(null)}
                  />
                )}
                {visibles.map((g) => {
                  const info = INFO[g.tipo];
                  return (
                    <CommandPrimitive.Group
                      key={g.tipo}
                      heading={
                        <span className="flex items-center justify-between">
                          <span>{info.plural}</span>
                          <span className="tabular-nums">{g.total}</span>
                        </span>
                      }
                      className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
                    >
                      {g.items.map((r) => (
                        <FilaResultado
                          key={r.clave}
                          r={r}
                          terminos={terminos}
                          onSelect={() => abrir(r)}
                        />
                      ))}
                      {!filtro && g.total > g.items.length && (
                        <CommandPrimitive.Item
                          value={`mas:${g.tipo}`}
                          onSelect={() => setFiltro(g.tipo)}
                          className="mx-1 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-primary data-[selected=true]:bg-accent"
                        >
                          Ver los {g.total} {info.plural.toLowerCase()}{" "}
                          <ArrowRight className="size-3.5" />
                        </CommandPrimitive.Item>
                      )}
                      {filtro && g.total > g.items.length && (
                        <CommandPrimitive.Item
                          value={`cargar:${g.tipo}`}
                          onSelect={() => setLimite((l) => l + PAGINA)}
                          className="mx-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium text-primary data-[selected=true]:bg-accent"
                        >
                          Mostrar más ({g.items.length} de {g.total})
                        </CommandPrimitive.Item>
                      )}
                    </CommandPrimitive.Group>
                  );
                })}
              </>
            )}
          </CommandPrimitive.List>

          {/* Pie con atajos */}
          <div className="hidden items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground sm:flex">
            <span className="tabular-nums">
              {vacia
                ? "Busca en todo el estudio"
                : `${totalVisible} resultado${totalVisible === 1 ? "" : "s"}`}
            </span>
            <span className="ml-auto hidden items-center gap-3 sm:flex">
              <Atajo teclas={["↑", "↓"]}>navegar</Atajo>
              <Atajo teclas={[<CornerDownLeft key="e" className="size-3" />]}>abrir</Atajo>
              <Atajo teclas={["Tab"]}>filtro</Atajo>
            </span>
          </div>
        </CommandPrimitive>
      </div>
    </div>
  );
}

function Atajo({ teclas, children }: { teclas: ReactNode[]; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      {teclas.map((t, i) => (
        <kbd
          key={i}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border px-1 font-mono text-[10px]"
        >
          {t}
        </kbd>
      ))}
      {children}
    </span>
  );
}

function FilaResultado({
  r,
  terminos,
  onSelect,
}: {
  r: Reciente & Partial<Resultado>;
  terminos: string[];
  onSelect: () => void;
}) {
  const info = INFO[r.tipo];
  const Icono = info.icon;
  return (
    <CommandPrimitive.Item
      value={r.clave}
      onSelect={onSelect}
      className="group mx-1 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 active:bg-accent data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground max-sm:mx-0 max-sm:data-[selected=true]:bg-transparent max-sm:active:bg-accent"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground group-data-[selected=true]:border-primary/40 group-data-[selected=true]:text-primary">
        <Icono className="size-4" />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            <Resaltar texto={r.titulo} terminos={terminos} />
          </span>
          {r.estado && (
            <Badge variant={TONO[r.estado.tono]} className="shrink-0 px-1.5 py-0 text-[10px]">
              {r.estado.texto}
            </Badge>
          )}
        </span>
        {r.subtitulo && (
          <span className="truncate text-xs text-muted-foreground">
            <Resaltar texto={r.subtitulo} terminos={terminos} />
          </span>
        )}
        {r.detalle && (
          <span className="truncate font-mono text-[11px] text-muted-foreground/80 sm:hidden">
            <Resaltar texto={r.detalle} terminos={terminos} />
          </span>
        )}
      </span>
      {r.detalle && (
        <span className="hidden max-w-[40%] shrink-0 truncate font-mono text-[11px] text-muted-foreground sm:block">
          <Resaltar texto={r.detalle} terminos={terminos} />
        </span>
      )}
      <span className="hidden shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/70 md:block">
        {info.label}
      </span>
    </CommandPrimitive.Item>
  );
}

const EJEMPLOS = [
  "45678912",
  "01234-2026",
  "audiencia",
  '"cobro de soles"',
  "cli:andinas",
  "quispe -alimentos",
];

function SinConsulta({
  recientes,
  paginas,
  filtro,
  onAbrir,
  onBorrar,
  onEjemplo,
}: {
  recientes: Reciente[];
  paginas: PaginaBuscable[];
  filtro: TipoBusqueda | null;
  onAbrir: (r: Reciente) => void;
  onBorrar: () => void;
  onEjemplo: (t: string) => void;
}) {
  const lista = filtro ? recientes.filter((r) => r.tipo === filtro) : recientes;
  const heading =
    "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground";
  return (
    <>
      {lista.length > 0 && (
        <CommandPrimitive.Group
          heading={
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <History className="size-3" /> Abiertos recientemente
              </span>
              <button
                type="button"
                onClick={onBorrar}
                className="normal-case tracking-normal hover:text-foreground"
              >
                Borrar
              </button>
            </span>
          }
          className={cn("mb-1", heading)}
        >
          {lista.map((r) => (
            <FilaResultado key={r.clave} r={r} terminos={[]} onSelect={() => onAbrir(r)} />
          ))}
        </CommandPrimitive.Group>
      )}
      {(!filtro || filtro === "pagina") && (
        <CommandPrimitive.Group heading="Ir a" className={cn("mb-1", heading)}>
          <div className="grid grid-cols-2 gap-1 px-1 sm:grid-cols-3">
            {paginas.map((p) => (
              <CommandPrimitive.Item
                key={p.to}
                value={`pagina:${p.to}`}
                onSelect={() =>
                  onAbrir({
                    clave: `pagina:${p.to}`,
                    tipo: "pagina",
                    titulo: p.label,
                    destino: { ruta: "pagina", to: p.to },
                  })
                }
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
              >
                <Compass className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{p.label}</span>
              </CommandPrimitive.Item>
            ))}
          </div>
        </CommandPrimitive.Group>
      )}
      <div className="mx-3 mt-3 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
        <p className="mb-2 flex items-center gap-1.5 font-medium text-foreground">
          <Clock className="size-3.5 text-primary" /> <span className="sm:hidden">Pruebe con</span>
          <span className="max-sm:hidden">Consejos de búsqueda</span>
        </p>
        <ul className="mb-2.5 hidden gap-1 sm:grid sm:grid-cols-2">
          <li>Sin tildes ni mayúsculas: «huaman» = «Huamán»</li>
          <li>Números con o sin guiones o espacios</li>
          <li>
            <span className="font-mono">"frase"</span> exacta ·{" "}
            <span className="font-mono">-palabra</span> para excluir
          </li>
          <li>
            <span className="font-mono">exp: cli: doc: plazo: tarea: evento: parte:</span>
          </li>
        </ul>
        <div className="flex flex-wrap gap-1.5">
          {EJEMPLOS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onEjemplo(e)}
              className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function SinResultados({
  texto,
  filtro,
  onQuitarFiltro,
}: {
  texto: string;
  filtro: TipoBusqueda | null;
  onQuitarFiltro: () => void;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <IconoLupa className="size-6" />
      </span>
      <p className="text-sm font-medium">Sin resultados para «{texto.trim()}»</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Pruebe con menos palabras, solo el apellido o los últimos dígitos del número.
      </p>
      {filtro && (
        <button
          type="button"
          onClick={onQuitarFiltro}
          className="mt-3 text-xs font-medium text-primary hover:underline"
        >
          Buscar en todo (quitar filtro «{INFO[filtro].plural}»)
        </button>
      )}
    </div>
  );
}
