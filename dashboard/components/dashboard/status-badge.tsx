import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStatusColor, STATE_LABELS } from "@/lib/status-colors";

interface StatusBadgeProps {
  state: string | null;
  sequenceComplete?: boolean;
}

export function StatusBadge({ state, sequenceComplete }: StatusBadgeProps) {
  if (sequenceComplete) {
    return (
      <Badge className="border-transparent bg-gray-400 text-white">완료</Badge>
    );
  }

  if (!state) return null;

  return (
    <Badge className={cn("border-transparent", getStatusColor(state))}>
      {STATE_LABELS[state] ?? state}
    </Badge>
  );
}
