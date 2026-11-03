import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid size-8 place-items-center rounded-md bg-gradient-primary font-display text-lg font-bold text-primary-foreground shadow-glow">
        K
      </span>
      {!compact && (
        <span className="font-display text-xl font-semibold tracking-tight text-foreground">
          Keve<span className="text-primary">legal</span>
        </span>
      )}
    </span>
  );
}
