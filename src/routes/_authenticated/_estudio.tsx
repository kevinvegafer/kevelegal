import { createFileRoute, redirect } from "@tanstack/react-router";
import { membresiasQuery } from "@/lib/queries";
import { getEstudioPreferido } from "@/hooks/use-estudio";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/_estudio")({
  beforeLoad: async ({ context }) => {
    const membresias = await context.queryClient.ensureQueryData(membresiasQuery());
    if (membresias.length === 0) throw redirect({ to: "/onboarding" });
    const pref = getEstudioPreferido();
    const actual = membresias.find((m) => m.estudio.id === pref) ?? membresias[0]!;
    return { estudio: actual.estudio, rol: actual.rol, membresias };
  },
  component: AppShell,
});
