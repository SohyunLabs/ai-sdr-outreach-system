"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SequenceBar } from "@/components/dashboard/sequence-bar";
import { getStatusSortOrder, getStatusGroup, getStatusGroupColor, getActionLabel, getActionColor, GREEN_STATES, RED_STATES } from "@/lib/status-colors";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isSequenceComplete, type CampaignLeadWithContact } from "@/lib/dashboard-utils";

interface LeadTableProps {
  leads: CampaignLeadWithContact[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onRowClick?: (lead: CampaignLeadWithContact) => void;
}

export function LeadTable({ leads, selectedIds, onSelectionChange, onRowClick }: LeadTableProps) {
  const router = useRouter();

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-medium">리드 없음</p>
        <p className="text-sm text-muted-foreground">
          이 캠페인에 리드가 없습니다
        </p>
      </div>
    );
  }

  const sortedLeads = [...leads].sort((a, b) => {
    const aUnmatched = !a.airtableContactId ? 1 : 0;
    const bUnmatched = !b.airtableContactId ? 1 : 0;
    if (aUnmatched !== bUnmatched) return aUnmatched - bUnmatched;
    return getStatusSortOrder(a.state) - getStatusSortOrder(b.state);
  });

  const selectableLeads = sortedLeads.filter((l) => !!l.airtableContactId);
  const allSelected =
    selectableLeads.length > 0 && selectableLeads.every((l) => selectedIds.has(l.id));
  const someSelected = !allSelected && selectableLeads.some((l) => selectedIds.has(l.id));

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selectedIds);
      selectableLeads.forEach((l) => next.delete(l.id));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds);
      selectableLeads.forEach((l) => next.add(l.id));
      onSelectionChange(next);
    }
  }

  function toggleOne(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={toggleAll}
              aria-label="Select all"
            />
          </TableHead>
          <TableHead className="text-xs uppercase tracking-wider">Name</TableHead>
          <TableHead className="text-xs uppercase tracking-wider">Company</TableHead>
          <TableHead className="text-xs uppercase tracking-wider">Role</TableHead>
          <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
          <TableHead className="text-xs uppercase tracking-wider">Action</TableHead>
          <TableHead className="text-xs uppercase tracking-wider">Sequence</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedLeads.map((lead) => {
          const isUnmatched = !lead.airtableContactId;
          const isSelected = selectedIds.has(lead.id);
          return (
            <TableRow
              key={lead.id}
              onClick={
                isUnmatched
                  ? undefined
                  : () => onRowClick
                    ? onRowClick(lead)
                    : router.push(`/leads/${lead.id}?from=campaign-analysis`)
              }
              className={cn(
                "hover:bg-muted/30",
                isUnmatched ? "bg-muted/50" : "cursor-pointer hover:bg-muted/50",
                isSelected && "bg-blue-50/60 dark:bg-blue-950/20",
              )}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                {!isUnmatched && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedIds);
                      if (checked) next.add(lead.id);
                      else next.delete(lead.id);
                      onSelectionChange(next);
                    }}
                    aria-label={`Select ${lead.contact?.name ?? lead.id}`}
                  />
                )}
              </TableCell>
              <TableCell>
                {isUnmatched ? (
                  <span className="text-muted-foreground text-xs font-mono truncate max-w-[120px]">
                    {lead.lemlistLeadId}
                  </span>
                ) : (
                  lead.contact?.name ?? "—"
                )}
              </TableCell>
              <TableCell className={cn(isUnmatched && "text-muted-foreground")}>
                {isUnmatched ? "—" : (lead.contact?.company ?? "—")}
              </TableCell>
              <TableCell className={cn(isUnmatched && "text-muted-foreground")}>
                {isUnmatched ? "—" : (lead.contact?.role ?? "—")}
              </TableCell>
              <TableCell>
                {isUnmatched ? (
                  <Badge className="border-transparent bg-purple-500 text-white">매칭 실패</Badge>
                ) : (() => {
                  const isPaused = lead.campaignStatus === "paused"
                    && !GREEN_STATES.has(lead.state ?? "")
                    && !RED_STATES.has(lead.state ?? "")
                    && lead.lemlistStatus !== "done";
                  if (isPaused) return <Badge className="border-transparent bg-gray-400 text-white">Paused</Badge>;
                  const complete = isSequenceComplete(lead);
                  const group = getStatusGroup(lead.state, complete);
                  return (
                    <Badge className={cn("border-transparent", getStatusGroupColor(group, lead.state))}>
                      {group === "to-launch" ? "To Launch" : group === "in-progress" ? "In Progress" : "Complete"}
                    </Badge>
                  );
                })()}
              </TableCell>
              <TableCell>
                {!isUnmatched && (() => {
                  const complete = isSequenceComplete(lead);
                  return (
                    <Badge className={cn(getActionColor(lead.state, complete, lead.lemlistStatus))}>
                      {getActionLabel(lead.state, complete, lead.lemlistStatus)}
                    </Badge>
                  );
                })()}
              </TableCell>
              <TableCell>
                <SequenceBar
                  step={lead.sequenceStep}
                  total={lead.totalSequenceSteps}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
