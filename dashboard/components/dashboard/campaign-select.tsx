import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type CampaignWithLeads } from "@/lib/dashboard-utils";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
  ended: "Ended",
};

interface CampaignSelectProps {
  campaigns: CampaignWithLeads[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function CampaignSelect({ campaigns, selectedId, onSelect }: CampaignSelectProps) {
  const selected = campaigns.find((c) => c.id === selectedId);

  return (
    <div className="flex items-center gap-4">
      <Select value={selectedId} onValueChange={onSelect}>
        <SelectTrigger className="w-96">
          <SelectValue placeholder="Select campaign">
            {selected?.name ?? "Select campaign"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {campaigns.map((c) => {
            const statusLabel = c.status ? (STATUS_LABEL[c.status] ?? c.status) : null;
            return (
              <SelectItem key={c.id} value={c.id}>
                <span className="font-medium">{c.name}</span>
                {statusLabel && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    · {statusLabel}
                  </span>
                )}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
