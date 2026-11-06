import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Building, ChevronRight, Plus, Search, User, Users } from "lucide-react";
import { clientesQuery, expedientesQuery, nombreCliente } from "@/lib/queries";
import { useEstudio } from "@/hooks/use-estudio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, NativeSelect, PageHeader } from "@/components/app/ui";
import { ClienteForm } from "@/components/forms/ClienteForm";

export const Route = createFileRoute("/_authenticated/_estudio/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — Kevelegal" },
      { name: "description", content: "Cartera de clientes del estudio: personas naturales y jurídicas." },
      { property: "og:title", content: "Clientes — Kevelegal" },
      { property: "og:description", content: "Cartera de clientes del estudio." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(clientesQuery(context.estudio.id)),
      context.queryClient.ensureQueryData(expedientesQuery(context.estudio.id)),
    ]),
  component: ClientesPage,
});

const ESTADO_VARIANT = { activo: "success", prospecto: "primary", inactivo: "muted" } as const;

function ClientesPage() {
  const { estudioId } = useEstudio();
  const navigate = useNavigate();
  const { data: clientes } = useSuspenseQuery(clientesQuery(estudioId));
  const { data: expedientes } = useSuspenseQuery(expedientesQuery(estudioId));
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState("");
  const [open, setOpen] = useState(false);

  const conteo = useMemo(() => {
    const m = new Map<string, number>();
    expedientes.forEach((e) => e.cliente_id && m.set(e.cliente_id, (m.get(e.cliente_id) ?? 0) + 1));
    return m;
  }, [expedientes]);

  const filtrados = clientes.filter((c) => {
    const texto = `${nombreCliente(c)} ${c.numero_documento} ${c.email ?? ""} ${c.telefono ?? ""}`.toLowerCase();
    return (
      (!q || texto.includes(q.toLowerCase())) &&
      (!estado || c.estado === estado) &&
      (!tipo || c.tipo_persona === tipo)
    );
  });

  return (
    <>
      <PageHeader
        title="Clientes"
        description={`${clientes.length} registrados`}
        actions={
          <Button variant="hero" onClick={() => setOpen(true)}>
            <Plus /> Nuevo cliente
          </Button>
        }
      />

      {clientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aún no hay clientes"
          description="Registre personas naturales con DNI o CE, y empresas con RUC."
          action={
            <Button variant="hero" onClick={() => setOpen(true)}>
              <Plus /> Registrar cliente
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative min-w-60 flex-1">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, DNI, RUC, correo…" className="pl-9" />
            </div>
            <NativeSelect value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-auto">
              <option value="">Todos los tipos</option>
              <option value="natural">Persona natural</option>
              <option value="juridica">Persona jurídica</option>
            </NativeSelect>
            <NativeSelect value={estado} onChange={(e) => setEstado(e.target.value)} className="w-auto">
              <option value="">Todos los estados</option>
              <option value="prospecto">Prospecto</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </NativeSelect>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card md:hidden">
            {filtrados.map((c) => (
              <li key={c.id}>
                <Link
                  to="/clientes/$id"
                  params={{ id: c.id }}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-accent/60"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                    {c.tipo_persona === "juridica" ? <Building className="size-5" /> : <User className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{nombreCliente(c)}</span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {c.tipo_documento} {c.numero_documento} · {conteo.get(c.id) ?? 0} expediente(s)
                    </span>
                  </span>
                  <Badge variant={ESTADO_VARIANT[c.estado as keyof typeof ESTADO_VARIANT] ?? "muted"} className="shrink-0 capitalize">
                    {c.estado}
                  </Badge>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
            {filtrados.length === 0 && (
              <li className="py-10 text-center text-sm text-muted-foreground">Ningún cliente coincide con los filtros.</li>
            )}
          </ul>

          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Contacto</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Ubicación</th>
                  <th className="px-4 py-3 font-medium">Expedientes</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtrados.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer transition-colors hover:bg-accent/40"
                    onClick={() => navigate({ to: "/clientes/$id", params: { id: c.id } })}
                  >
                    <td className="px-4 py-3">
                      <Link to="/clientes/$id" params={{ id: c.id }} className="flex items-center gap-2 font-medium">
                        {c.tipo_persona === "juridica" ? (
                          <Building className="size-4 text-primary" />
                        ) : (
                          <User className="size-4 text-primary" />
                        )}
                        {nombreCliente(c)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {c.tipo_documento} {c.numero_documento}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{c.telefono || c.email || "—"}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {[c.distrito, c.departamento].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">{conteo.get(c.id) ?? 0}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ESTADO_VARIANT[c.estado as keyof typeof ESTADO_VARIANT] ?? "muted"} className="capitalize">
                        {c.estado}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtrados.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">Ningún cliente coincide con los filtros.</p>
            )}
          </div>
        </>
      )}

      {open && (
        <ClienteForm
          open
          onOpenChange={setOpen}
          onSaved={(id) => navigate({ to: "/clientes/$id", params: { id } })}
        />
      )}
    </>
  );
}
