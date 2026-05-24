import { cn } from "@/lib/utils";

export function SequenceBar({
  step,
  total,
}: {
  step: number | null;
  total: number | null;
}) {
  const segments = total ?? 6;
  const filled = Math.min(step ?? 0, segments);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 w-5 rounded-sm",
              i < filled ? "bg-primary" : "bg-border"
            )}
          />
        ))}
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {filled}/{segments}
      </span>
    </div>
  );
}
