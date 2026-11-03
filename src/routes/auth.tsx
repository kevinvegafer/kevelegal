import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app/Logo";
import { FlaskConical } from "lucide-react";
import { entrarModoPrueba } from "@/lib/demo";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Ingresar — Kevelegal" },
      { name: "description", content: "Ingrese o cree su cuenta de Kevelegal para gestionar su estudio jurídico." },
      { property: "og:title", content: "Ingresar — Kevelegal" },
      { property: "og:description", content: "Acceso al software de gestión jurídica Kevelegal." },
    ],
  }),
  component: AuthPage,
});

function safePath(p?: string) {
  if (!p) return "/dashboard";
  try {
    const u = new URL(p, window.location.origin);
    if (u.origin !== window.location.origin) return "/dashboard";
    return u.pathname + u.search;
  } catch {
    return "/dashboard";
  }
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: safePath(redirect), replace: true });
    });
  }, [navigate, redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: safePath(redirect), replace: true });
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + safePath(redirect),
            data: { nombre_completo: nombre },
          },
        });
        if (error) throw error;
        if (data.session) navigate({ to: safePath(redirect), replace: true });
        else setSent("Le enviamos un correo para confirmar su cuenta. Revise su bandeja de entrada.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("Si el correo existe, recibirá un enlace para restablecer su contraseña.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? traducir(err.message) : "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  }

  async function social(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) {
      toast.error("No se pudo iniciar sesión");
      return;
    }
    if (result.redirected) return;
    navigate({ to: safePath(redirect), replace: true });
  }

  async function modoPrueba() {
    setDemoLoading(true);
    try {
      await entrarModoPrueba();
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar el modo prueba");
      setDemoLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden border-r border-border bg-sidebar lg:block">
        <div className="absolute inset-0 grid-lines opacity-60" />
        <div className="absolute inset-0 bg-hero" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/">
            <Logo />
          </Link>
          <div className="max-w-md">
            <p className="font-display text-4xl leading-tight text-foreground">
              Cada expediente, plazo y sol de honorarios,{" "}
              <span className="text-gradient-primary">bajo control.</span>
            </p>
            <p className="mt-4 text-muted-foreground">
              Hecho para el ejercicio del derecho en el Perú: DNI, RUC, distritos judiciales y
              feriados nacionales incluidos.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Kevelegal</p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-3xl font-semibold">
            {mode === "login" ? "Ingresar" : mode === "signup" ? "Crear cuenta" : "Recuperar acceso"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login"
              ? "Acceda a su estudio jurídico."
              : mode === "signup"
                ? "Registre su cuenta y luego cree su estudio o acepte una invitación."
                : "Le enviaremos un enlace a su correo."}
          </p>

          {sent ? (
            <div className="mt-8 rounded-lg border border-primary/40 bg-accent p-4 text-sm text-accent-foreground">
              {sent}
              <button
                className="mt-3 block text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setSent(null);
                  setMode("login");
                }}
              >
                Volver a ingresar
              </button>
            </div>
          ) : (
            <>
              {mode !== "forgot" && (
                <div className="mt-8 grid gap-2">
                  <Button variant="hero" type="button" disabled={demoLoading} onClick={modoPrueba}>
                    <FlaskConical /> {demoLoading ? "Preparando su estudio de prueba…" : "Entrar en modo prueba"}
                  </Button>
                  <p className="mb-2 text-center text-xs text-muted-foreground">
                    Sin registro. Explore con un estudio vacío; los datos se borran al cerrar sesión.
                  </p>
                  <Button variant="outline" type="button" onClick={() => social("google")}>
                    <GoogleIcon /> Continuar con Google
                  </Button>
                  <button type="button" className="lovable-auth-button" onClick={() => social("lovable")}>
                    Continue with Lovable
                  </button>
                  <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> o con su correo{" "}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </div>
              )}

              <form onSubmit={submit} className={mode === "forgot" ? "mt-8 grid gap-4" : "grid gap-4"}>
                {mode === "signup" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="nombre">Nombre completo</Label>
                    <Input id="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {mode !== "forgot" && (
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Contraseña</Label>
                      {mode === "login" && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => setMode("forgot")}
                        >
                          ¿Olvidó su contraseña?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                )}
                <Button type="submit" variant="hero" disabled={loading}>
                  {loading
                    ? "Procesando…"
                    : mode === "login"
                      ? "Ingresar"
                      : mode === "signup"
                        ? "Crear cuenta"
                        : "Enviar enlace"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>
                    ¿No tiene cuenta?{" "}
                    <button className="text-primary hover:underline" onClick={() => setMode("signup")}>
                      Regístrese
                    </button>
                  </>
                ) : (
                  <>
                    ¿Ya tiene cuenta?{" "}
                    <button className="text-primary hover:underline" onClick={() => setMode("login")}>
                      Ingrese
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function traducir(msg: string) {
  if (/Invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos";
  if (/Email not confirmed/i.test(msg)) return "Debe confirmar su correo antes de ingresar";
  if (/already registered/i.test(msg)) return "Este correo ya está registrado";
  return msg;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M21.35 11.1H12v2.9h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95S8.78 6.2 12 6.2c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.7 3.67 14.56 2.7 12 2.7 6.9 2.7 2.75 6.85 2.75 12S6.9 21.3 12 21.3c5.34 0 8.88-3.75 8.88-9.04 0-.6-.07-1.06-.15-1.16z" />
    </svg>
  );
}
