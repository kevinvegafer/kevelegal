import { useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarDays, FileText, ListChecks, MessageSquare, Wallet, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/lib/demo-db/client";
import { useEstudio } from "@/hooks/use-estudio";
import { mensajeError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const avisosQuery = (estudioId: string) =>
  queryOptions({
    queryKey: ["avisos", estudioId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mis_avisos", { _estudio: estudioId });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

const ICONO: Record<string, typeof Bell> = {
  evento: CalendarDays,
  cita: CalendarDays,
  plazo: ListChecks,
  cuota: Wallet,
  mensaje: MessageSquare,
  documento: FileText,
};

export function AvisosCampana() {
  const { estudioId } = useEstudio();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: avisos = [] } = useQuery(avisosQuery(estudioId));

  const descartar = useMutation({
    mutationFn: async (claves: string[]) => {
      if (!claves.length) return;
      const { error } = await supabase
        .from("avisos_descartados")
        .upsert(claves.map((clave) => ({ clave })), { onConflict: "user_id,clave", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["avisos"] }),
    onError: (e) => toast.error(mensajeError(e)),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Avisos (${avisos.length})`} className="relative">
          <Bell />
          {avisos.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {avisos.length > 99 ? "99+" : avisos.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Avisos</p>
          {avisos.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => descartar.mutate(avisos.map((a) => a.clave))}>
              Marcar todo como visto
            </Button>
          )}
        </div>
        {avisos.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No tiene avisos pendientes.</p>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {avisos.map((a) => {
              const Icon = ICONO[a.tipo] ?? Bell;
              return (
                <li key={a.clave} className="group flex gap-3 px-4 py-3 hover:bg-accent/40">
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      if (a.enlace) void navigate({ to: a.enlace });
                    }}
                  >
                    <p className="text-sm font-medium">{a.titulo}</p>
                    {a.detalle && <p className="line-clamp-2 text-xs text-muted-foreground">{a.detalle}</p>}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(a.fecha), { addSuffix: true, locale: es })}
                    </p>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Descartar aviso"
                    className="size-7 opacity-60 group-hover:opacity-100"
                    onClick={() => descartar.mutate([a.clave])}
                  >
                    <X />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
