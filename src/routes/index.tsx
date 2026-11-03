import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  FolderKanban,
  Gavel,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import heroImg from "@/assets/hero-palacio.jpg";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kevelegal — Software de gestión jurídica para estudios en el Perú" },
      {
        name: "description",
        content:
          "Gestione clientes, expedientes, plazos procesales, audiencias y honorarios en soles. Diseñado para abogados y estudios jurídicos del Perú.",
      },
      { property: "og:title", content: "Kevelegal — Gestión jurídica hecha para el Perú" },
      {
        property: "og:description",
        content: "Expedientes, plazos en días hábiles, audiencias, documentos y honorarios en un solo lugar.",
      },
    ],
  }),
  component: Landing,
});

const modulos = [
  { icon: Users, t: "Clientes", d: "Personas naturales y jurídicas con DNI, RUC o CE validados." },
  { icon: FolderKanban, t: "Expedientes", d: "Número del Poder Judicial, órgano, juez, partes y bitácora." },
  { icon: CalendarClock, t: "Plazos y audiencias", d: "Vencimientos en días hábiles con feriados nacionales." },
  { icon: Wallet, t: "Honorarios", d: "Acuerdos en soles, pagos por Yape, Plin o transferencia y gastos." },
  { icon: Gavel, t: "Documentos", d: "Escritos y resoluciones organizados por expediente." },
  { icon: ShieldCheck, t: "Seguridad", d: "Cada estudio ve solo su información. Roles y auditoría." },
];

function Landing() {
  const [logged, setLogged] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogged(!!data.session));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Logo />
          {logged ? (
            <Button asChild variant="hero">
              <Link to="/dashboard">Ir a mi estudio</Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost">
                <Link to="/auth">Ingresar</Link>
              </Button>
              <Button asChild variant="hero">
                <Link to="/auth">Crear cuenta</Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      <section className="relative isolate overflow-hidden">
        <img
          src={heroImg}
          alt="Palacio de Justicia de Lima iluminado de noche"
          width={1600}
          height={1008}
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-background to-transparent" />
        <div className="mx-auto flex min-h-[88vh] max-w-7xl flex-col justify-center px-6 pt-24 pb-16">
          <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Hecho para el Perú
          </p>
          <h1 className="max-w-3xl text-5xl leading-[1.05] font-semibold md:text-7xl">
            La gestión de su estudio jurídico,{" "}
            <span className="text-gradient-primary">sin plazos vencidos.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Clientes, expedientes, audiencias, documentos y honorarios en soles. Con feriados
            nacionales, validación de DNI y RUC, y los 34 distritos judiciales del país.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="hero">
              <Link to={logged ? "/dashboard" : "/auth"}>
                {logged ? "Abrir Kevelegal" : "Empezar ahora"}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="max-w-2xl text-3xl font-semibold md:text-4xl">
          Todo el ciclo del caso, de la consulta al cobro.
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {modulos.map((m) => (
            <div key={m.t} className="bg-card p-7">
              <m.icon className="size-6 text-primary" />
              <h3 className="mt-4 text-xl font-semibold">{m.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{m.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <Logo />
          <span>© {new Date().getFullYear()} Kevelegal · Lima, Perú</span>
        </div>
      </footer>
    </div>
  );
}
