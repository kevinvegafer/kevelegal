import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronsUpDown,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Search,
  Settings,
  UserRound,
  Users,
  Wallet,
  Workflow,
  Columns3,
  MessageSquare,
  Timer,
  BarChart3,
  Sparkles,
  DatabaseBackup,
  Menu,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { useEstudio, setEstudioPreferido } from "@/hooks/use-estudio";
import { supabase } from "@/lib/demo-db/client";
import { clientesQuery, expedientesQuery, nombreCliente, perfilQuery } from "@/lib/queries";
import { AvisosCampana } from "./Avisos";
import { CronometrosBarra } from "./Cronometros";

const ROL_LABEL = { admin: "Administrador", abogado: "Abogado", asistente: "Asistente" } as const;

export function AppShell() {
  const { estudio, rol, membresias, puedeVerFinanzas, esAdmin, user } = useEstudio();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: perfil } = useQuery(perfilQuery());

  const nav = [
    { to: "/dashboard", label: "Panel", icon: LayoutDashboard },
    { to: "/clientes", label: "Clientes", icon: Users },
    { to: "/expedientes", label: "Expedientes", icon: FolderKanban },
    { to: "/plazos", label: "Plazos y tareas", icon: ListChecks },
    { to: "/calendario", label: "Calendario", icon: CalendarDays },
    { to: "/plantillas", label: "Plantillas", icon: Workflow },
    { to: "/tablero", label: "Tablero de casos", icon: Columns3 },
    { to: "/mensajes", label: "Mensajes", icon: MessageSquare },
    { to: "/tiempo", label: "Tiempo", icon: Timer },
    ...(puedeVerFinanzas ? [{ to: "/finanzas", label: "Honorarios y gastos", icon: Wallet }] : []),
    ...(puedeVerFinanzas ? [{ to: "/reportes", label: "Reportes", icon: BarChart3 }] : []),
    { to: "/asistente", label: "Asistente IA", icon: Sparkles },
  ] as const;
  const navAdmin = [
    { to: "/equipo", label: "Equipo", icon: UserRound },
    { to: "/configuracion", label: "Configuración", icon: Settings },
    ...(esAdmin ? [{ to: "/respaldo", label: "Respaldo", icon: DatabaseBackup }] : []),
  ] as const;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function cambiarEstudio(id: string) {
    setEstudioPreferido(id);
    queryClient.clear();
    window.location.assign("/dashboard");
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 py-4">
          <Link to="/dashboard" className="group-data-[collapsible=icon]:hidden">
            <Logo />
          </Link>
          <Link to="/dashboard" className="hidden group-data-[collapsible=icon]:block">
            <Logo compact />
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Gestión</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.to)} tooltip={item.label}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Estudio</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navAdmin.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.to)} tooltip={item.label}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" tooltip={estudio.nombre}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                      <Building2 className="size-4" />
                    </span>
                    <span className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-semibold">{estudio.nombre}</span>
                      <span className="truncate text-xs text-muted-foreground">{ROL_LABEL[rol]}</span>
                    </span>
                    <ChevronsUpDown className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-64">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {perfil?.nombre_completo || user.email}
                  </DropdownMenuLabel>
                  {membresias.length > 1 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs">Cambiar de estudio</DropdownMenuLabel>
                      {membresias.map((m) => (
                        <DropdownMenuItem
                          key={m.estudio.id}
                          disabled={m.estudio.id === estudio.id}
                          onSelect={() => cambiarEstudio(m.estudio.id)}
                        >
                          <Building2 /> {m.estudio.nombre}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate({ to: "/onboarding" })}>
                    <Building2 /> Crear o unirse a otro estudio
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={signOut}>
                    <LogOut /> Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="tab-bar pt-safe sticky top-0 z-20 border-b border-border/60 md:bg-background/85 md:shadow-none">
          <div className="flex h-14 min-w-0 items-center gap-2 px-4 sm:gap-3">
            <SidebarTrigger className="shrink-0 max-md:hidden" />
            <Link to="/dashboard" className="flex shrink-0 items-center gap-2 md:hidden" aria-label="Ir al panel">
              <Logo compact />
              <span className="font-display text-lg font-semibold">{estudio.nombre}</span>
            </Link>
            <Button
              variant="outline"
              className="h-9 min-w-0 flex-1 justify-start text-muted-foreground max-md:hidden md:max-w-md"
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar clientes o expedientes"
            >
              <Search className="shrink-0" />
              <span className="truncate">Buscar clientes o expedientes…</span>
              <kbd className="ml-auto hidden rounded border border-border px-1.5 font-mono text-[10px] lg:inline">
                Ctrl K
              </kbd>
            </Button>
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full md:hidden"
                onClick={() => setSearchOpen(true)}
                aria-label="Buscar clientes o expedientes"
              >
                <Search />
              </Button>
              <CronometrosBarra />
              <AvisosCampana />
            </div>
          </div>
        </header>
        <main className="pb-tabbar mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 pt-5 sm:pt-8 md:px-8 md:pb-8">
          <div key={pathname} className="animate-in fade-in slide-in-from-bottom-2 duration-300 md:slide-in-from-bottom-0">
            <Outlet />
          </div>
        </main>
        <BarraPestanas pathname={pathname} />
      </SidebarInset>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} estudioId={estudio.id} />
    </SidebarProvider>
  );
}

const PESTANAS = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/expedientes", label: "Casos", icon: FolderKanban },
  { to: "/plazos", label: "Plazos", icon: ListChecks },
  { to: "/calendario", label: "Agenda", icon: CalendarDays },
] as const;

/** Barra de pestañas inferior en celular, como una app nativa. */
function BarraPestanas({ pathname }: { pathname: string }) {
  const { setOpenMobile, openMobile } = useSidebar();
  const enPestana = PESTANAS.some((p) => pathname.startsWith(p.to));
  useEffect(() => setOpenMobile(false), [pathname, setOpenMobile]);
  const item = "relative flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1.5 text-[10px] font-medium transition-colors active:scale-95";
  return (
    <nav aria-label="Navegación principal" className="tab-bar pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border/60 md:hidden">
      <div className="mx-auto flex max-w-md">
        {PESTANAS.map((p) => {
          const activa = pathname.startsWith(p.to);
          return (
            <Link key={p.to} to={p.to} className={cn(item, activa ? "text-primary" : "text-muted-foreground")} aria-current={activa ? "page" : undefined}>
              <span className={cn("grid h-7 w-14 place-items-center rounded-full transition-colors", activa && "bg-primary/15")}>
                <p.icon className="size-5" strokeWidth={activa ? 2.4 : 1.8} />
              </span>
              {p.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className={cn(item, !enPestana || openMobile ? "text-primary" : "text-muted-foreground")}
          aria-label="Más secciones"
        >
          <span className={cn("grid h-7 w-14 place-items-center rounded-full transition-colors", (!enPestana || openMobile) && "bg-primary/15")}>
            <Menu className="size-5" />
          </span>
          Más
        </button>
      </div>
    </nav>
  );
}

function GlobalSearch({
  open,
  onOpenChange,
  estudioId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  estudioId: string;
}) {
  const navigate = useNavigate();
  const { data: clientes = [] } = useQuery({ ...clientesQuery(estudioId), enabled: open });
  const { data: expedientes = [] } = useQuery({ ...expedientesQuery(estudioId), enabled: open });

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Nombre, DNI, RUC, número de expediente…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        <CommandGroup heading="Expedientes">
          {expedientes.slice(0, 50).map((e) => (
            <CommandItem
              key={e.id}
              value={`${e.titulo} ${e.numero_expediente ?? ""} ${nombreCliente(e.cliente)}`}
              onSelect={() => {
                onOpenChange(false);
                navigate({ to: "/expedientes/$id", params: { id: e.id } });
              }}
            >
              <FolderKanban />
              <span className="truncate">{e.titulo}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">{e.numero_expediente}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Clientes">
          {clientes.slice(0, 50).map((c) => (
            <CommandItem
              key={c.id}
              value={`${nombreCliente(c)} ${c.numero_documento}`}
              onSelect={() => {
                onOpenChange(false);
                navigate({ to: "/clientes/$id", params: { id: c.id } });
              }}
            >
              <Users />
              <span className="truncate">{nombreCliente(c)}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {c.tipo_documento} {c.numero_documento}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
