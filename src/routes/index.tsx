import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  Check,
  Clock,
  FileText,
  FolderKanban,
  KanbanSquare,
  MessageSquare,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  Timer,
  Users,
  Wallet,
} from "lucide-react";
import heroImg from "@/assets/hero-palacio.webp";
import heroImgSm from "@/assets/hero-palacio-960.webp";
import fundadorImg from "@/assets/fundador.webp";
import fundadorImgSm from "@/assets/fundador-640.webp";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/Logo";
import { supabase } from "@/lib/demo-db/client";

const PRECIO = 35;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kevelegal — S/ 35 por abogado al mes, todo incluido" },
      {
        name: "description",
        content:
          "Software jurídico para estudios del Perú: expedientes, plazos en días hábiles, audiencias, documentos con IA y cobranza. Un solo plan: S/ 35 por abogado al mes.",
      },
      { property: "og:title", content: "Kevelegal — Un solo plan, todas las funciones, S/ 35 por abogado" },
      {
        property: "og:description",
        content: "Gestione su estudio jurídico sin perder un plazo. Todas las funciones por S/ 35 al mes por abogado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "preload",
        as: "image",
        href: heroImg,
        imageSrcSet: `${heroImgSm} 960w, ${heroImg} 1600w`,
        imageSizes: "100vw",
        fetchPriority: "high",
      },
    ],
  }),
  component: Landing,
});

const dolores = [
  { t: "Un plazo vencido cuesta un caso", d: "Y a veces, un cliente. Contar días hábiles a mano, con feriados, es donde se cometen los errores." },
  { t: "La información vive en cinco lugares", d: "Excel, WhatsApp, el correo, carpetas físicas y la memoria del practicante." },
  { t: "Honorarios que nadie cobra", d: "Cuotas atrasadas que se olvidan porque nadie lleva la cuenta al día." },
];

const funciones = [
  { icon: Clock, t: "Plazos en días hábiles", d: "Calcula vencimientos con los feriados nacionales del Perú y le avisa antes." },
  { icon: FolderKanban, t: "Expedientes completos", d: "Número del Poder Judicial, órgano, juez, partes, bitácora y campos propios." },
  { icon: KanbanSquare, t: "Tablero por etapas", d: "Vea todos sus casos por fase y aplique plantillas de tareas al avanzar." },
  { icon: CalendarClock, t: "Calendario y audiencias", d: "Audiencias, reuniones y recordatorios de todo el equipo en un solo lugar." },
  { icon: Bot, t: "Asistente con IA", d: "Resume escritos y resoluciones, y le ayuda a redactar en segundos." },
  { icon: Wallet, t: "Honorarios y cobranza", d: "Acuerdos en soles, cuotas, pagos por Yape, Plin o transferencia y gastos." },
  { icon: Timer, t: "Control de tiempo", d: "Cronómetro por caso y horas listas para facturar." },
  { icon: Users, t: "Portal del cliente", d: "Su cliente ve el avance de su caso y le envía documentos sin llamarle." },
  { icon: MessageSquare, t: "Citas en línea", d: "Una agenda pública para que los clientes reserven consulta solos." },
  { icon: FileText, t: "Documentos y enlaces", d: "Archivos por expediente y enlaces que vencen y puede revocar." },
  { icon: Search, t: "Buscador instantáneo", d: "Encuentre cualquier cliente, caso o documento con Ctrl K." },
  { icon: ShieldCheck, t: "Equipo, roles y auditoría", d: "Cada estudio ve solo lo suyo. Cada cambio queda registrado." },
];

const incluye = [
  "Expedientes y clientes ilimitados",
  "Plazos en días hábiles con feriados",
  "Calendario, audiencias y recordatorios",
  "Asistente con IA para documentos",
  "Honorarios, cuotas y cobranza",
  "Portal del cliente y citas en línea",
  "Control de tiempo y reportes",
  "Roles, auditoría y respaldo",
  "Todas las funciones nuevas que salgan",
];

const preguntas = [
  { q: "¿Hay otros planes?", a: "No. Hay un solo plan con todas las funciones: S/ 35 al mes por cada abogado del estudio. Sin funciones bloqueadas ni costos escondidos." },
  { q: "¿Cómo se cobra?", a: "Se paga S/ 35 mensuales por cada abogado que use Kevelegal. Si su estudio tiene 4 abogados, paga S/ 140 al mes." },
  { q: "¿Sirve para un abogado independiente?", a: "Sí. Un abogado solo paga S/ 35 al mes y tiene exactamente las mismas funciones que un estudio grande." },
  { q: "¿Mi información está segura?", a: "Cada estudio solo ve su propia información, con roles por persona y un registro de cada cambio." },
];

function Landing() {
  const [logged, setLogged] = useState(false);
  const [abogados, setAbogados] = useState(3);
  useEffect(() => {
    if (!import.meta.env["VITE_SUPABASE_URL"]) return;
    supabase.auth.getSession().then(({ data }) => setLogged(!!data.session)).catch(() => {});
  }, []);

  const destino = logged ? "/dashboard" : "/auth";
  const total = abogados * PRECIO;

  return (
    <div className="min-h-screen">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Logo />
          <nav className="flex items-center gap-2">
            <a href="#precio" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground sm:inline">
              Precio
            </a>
            {logged ? (
              <Button asChild variant="hero">
                <Link to="/dashboard">Ir a mi estudio</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link to="/auth">Ingresar</Link>
                </Button>
                <Button asChild variant="hero">
                  <Link to="/auth">Suscribirme</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Portada */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroImg}
          srcSet={`${heroImgSm} 960w, ${heroImg} 1600w`}
          sizes="100vw"
          fetchPriority="high"
          decoding="async"
          alt="Palacio de Justicia de Lima iluminado de noche"
          width={1600}
          height={1008}
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/85 to-background/30" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-background to-transparent" />
        <div className="mx-auto grid min-h-[92vh] max-w-7xl items-center gap-12 px-6 pt-28 pb-20 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="size-1.5 rounded-full bg-primary" />
              Fundado por <span className="font-semibold text-foreground">Kevin Enrique Vega Fernández</span>
            </p>
            <h1 className="font-display text-5xl leading-[1.02] font-semibold md:text-7xl">
              Su estudio, en orden.
              <br />
              <span className="text-gradient-primary">Ningún plazo perdido.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Kevelegal reúne casos, plazos, audiencias, documentos y cobranza en un solo lugar,
              con las reglas del Perú ya incorporadas. Usted se dedica a ganar casos.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" variant="hero" className="h-12 px-7 text-base">
                <Link to={destino}>
                  {logged ? "Abrir Kevelegal" : `Empezar por S/ ${PRECIO} al mes`}
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <span className="text-sm text-muted-foreground">Un solo plan · todas las funciones</span>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/30 bg-card/80 p-7 shadow-glow backdrop-blur-md">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Precio único</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-6xl font-semibold">S/ {PRECIO}</span>
              <span className="text-muted-foreground">/ abogado al mes</span>
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {incluye.slice(0, 5).map((i) => (
                <li key={i} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {i}
                </li>
              ))}
            </ul>
            <a href="#precio" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Ver todo lo incluido <ArrowRight className="size-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* Fundador */}
      <section className="relative isolate overflow-hidden border-y border-border">
        <div className="absolute inset-0 -z-10 grid-lines opacity-40" />
        <div className="mx-auto grid max-w-7xl items-stretch gap-0 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative overflow-hidden rounded-t-2xl lg:rounded-l-2xl lg:rounded-tr-none">
            <img
              src={fundadorImg}
              srcSet={`${fundadorImgSm} 640w, ${fundadorImg} 1024w`}
              sizes="(min-width: 1024px) 40vw, 100vw"
              loading="lazy"
              decoding="async"
              width={1024}
              height={1280}
              alt="Kevin Enrique Vega Fernández, CEO y fundador de Kevelegal, en su oficina de Lima"
              className="h-full max-h-[640px] w-full object-cover object-top"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/90 to-transparent" />
            <p className="absolute bottom-5 left-6 font-mono text-xs tracking-[0.3em] text-primary uppercase">
              Lima · Perú
            </p>
          </div>

          <div className="flex flex-col justify-center rounded-b-2xl border border-border bg-card/90 p-8 backdrop-blur-sm md:p-12 lg:rounded-r-2xl lg:rounded-bl-none lg:border-l-0">
            <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">El fundador</p>
            <h2 className="mt-5 font-display text-4xl leading-[1.05] font-semibold md:text-6xl">
              Kevin Enrique
              <br />
              Vega Fernández
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">CEO y fundador de Kevelegal</p>
            <div className="mt-8 h-px w-24 bg-gradient-primary" />
            <p className="mt-8 max-w-lg text-lg leading-relaxed">
              Kevelegal nació con una sola regla: <span className="text-primary">los plazos no se
              pierden</span>. Un estudio que controla sus fechas, sus documentos y su cobranza
              es un estudio que gana.
            </p>
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-8">
              {[
                ["Precisión", "Cada plazo, a tiempo"],
                ["Reserva", "Su información, solo suya"],
                ["Resultados", "Más tiempo para ganar"],
              ].map(([t, d]) => (
                <div key={t}>
                  <p className="font-display text-lg font-semibold">{t}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
            <p className="mt-10 font-firma text-5xl leading-none text-primary" aria-hidden="true">
              Kevin Vega
            </p>
          </div>
        </div>
      </section>

      {/* El problema */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="max-w-2xl font-display text-3xl font-semibold md:text-5xl">
          Lo que hoy le cuesta dinero a su estudio.
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {dolores.map((p, i) => (
            <div key={p.t} className="border-t-2 border-primary/60 pt-6">
              <span className="font-mono text-sm text-primary">0{i + 1}</span>
              <h3 className="mt-3 text-xl font-semibold">{p.t}</h3>
              <p className="mt-2 text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Funciones */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Todo incluido</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold md:text-5xl">
            Todo lo que su estudio necesita. Sin pagar extra por nada.
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {funciones.map((f) => (
              <div key={f.t} className="bg-background p-6 transition-colors hover:bg-card">
                <f.icon className="size-5 text-primary" />
                <h3 className="mt-4 font-semibold">{f.t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Precio */}
      <section id="precio" className="mx-auto max-w-7xl scroll-mt-10 px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Un solo plan</p>
          <h2 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
            S/ {PRECIO} por abogado. Todo incluido.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Sin planes básicos ni funciones bloqueadas. El mismo Kevelegal completo para un abogado
            independiente y para un estudio de cincuenta.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl overflow-hidden rounded-2xl border border-primary/40 shadow-glow lg:grid-cols-2">
          <div className="bg-card p-8 md:p-10">
            <h3 className="text-lg font-semibold">Plan Kevelegal</h3>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-6xl font-semibold">S/ {PRECIO}</span>
              <span className="text-muted-foreground">/ abogado al mes</span>
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {incluye.map((i) => (
                <li key={i} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {i}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col justify-between bg-accent/40 p-8 md:p-10">
            <div>
              <h3 className="text-lg font-semibold">¿Cuánto pagaría su estudio?</h3>
              <p className="mt-1 text-sm text-muted-foreground">Elija cuántos abogados usarán Kevelegal.</p>
              <div className="mt-8 flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Un abogado menos"
                  onClick={() => setAbogados((n) => Math.max(1, n - 1))}
                >
                  <Minus />
                </Button>
                <div className="min-w-24 text-center">
                  <span className="font-display text-5xl font-semibold tabular-nums">{abogados}</span>
                  <p className="text-xs text-muted-foreground">{abogados === 1 ? "abogado" : "abogados"}</p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Un abogado más"
                  onClick={() => setAbogados((n) => Math.min(200, n + 1))}
                >
                  <Plus />
                </Button>
              </div>
              <div className="mt-8 border-t border-border pt-6">
                <p className="text-sm text-muted-foreground">
                  {abogados} × S/ {PRECIO} =
                </p>
                <p className="font-display text-4xl font-semibold text-primary tabular-nums">
                  S/ {total.toLocaleString("es-PE")} <span className="text-base font-normal text-muted-foreground">al mes</span>
                </p>
              </div>
            </div>
            <Button asChild size="lg" variant="hero" className="mt-10 h-12 w-full text-base">
              <Link to={destino}>
                {logged ? "Abrir Kevelegal" : "Suscribir a mi estudio"}
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Preguntas */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <h2 className="font-display text-3xl font-semibold md:text-4xl">Preguntas frecuentes</h2>
        <div className="mt-10 divide-y divide-border border-y border-border">
          {preguntas.map((p) => (
            <details key={p.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {p.q}
                <Plus className="size-4 shrink-0 text-primary transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-3 text-muted-foreground">{p.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-primary px-8 py-14 text-center text-primary-foreground md:py-20">
          <h2 className="mx-auto max-w-3xl font-display text-4xl font-semibold md:text-5xl">
            Por menos de lo que cuesta un almuerzo a la semana.
          </h2>
          <p className="mx-auto mt-4 max-w-xl opacity-80">
            S/ {PRECIO} al mes por abogado. Todas las funciones, desde el primer día.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-8 h-12 px-8 text-base">
            <Link to={destino}>
              {logged ? "Abrir Kevelegal" : "Suscribirme ahora"}
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <Logo />
          <div className="text-right">
            <p>CEO: Kevin Enrique Vega Fernández</p>
            <p>© {new Date().getFullYear()} Kevelegal · Lima, Perú</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
