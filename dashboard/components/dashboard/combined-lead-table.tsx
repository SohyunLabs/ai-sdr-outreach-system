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
import { deriveCompletedActivities } from "@/lib/lead-profile-utils";

const TOTAL_STEPS = 5;
const M_STEP_LABELS = new Set(["M1", "M2", "M3", "LinkedIn Invite", "M5", "M6"]);

function computeEffectiveDone(lead: CampaignLeadWithContact): { done: number; total: number } {
  if (!lead.activities.length) return { done: lead.sequenceStep ?? 0, total: lead.totalSequenceSteps ?? TOTAL_STEPS };
  const hasEmail = lead.sequenceType === "email";
  const completed = deriveCompletedActivities(lead.activities, hasEmail);
  const sequenceDone = completed.has("M6");
  const done = sequenceDone
    ? TOTAL_STEPS
    : [...completed.keys()].filter(k => M_STEP_LABELS.has(k)).length;
  return { done, total: TOTAL_STEPS };
}

interface CombinedLeadTableProps {
  launchedLeads: CampaignLeadWithContact[];
  pendingLeads: CampaignLeadWithContact[];
  selectedPendingIds: Set<string>;
  onPendingSelectionChange: (ids: Set<string>) => void;
}

export function CombinedLeadTable({
  launchedLeads,
  pendingLeads,
  selectedPendingIds,
  onPendingSelectionChange,
}: CombinedLeadTableProps) {
  const router = useRouter();

  const sortedLaunched = [...launchedLeads].sort((a, b) => {
    const aU = !a.airtableContactId ? 1 : 0;
    const bU = !b.airtableContactId ? 1 : 0;
    if (aU !== bU) return aU - bU;
    return getStatusSortOrder(a.state) - getStatusSortOrder(b.state);
  });

  const selectablePending = pendingLeads.filter((l) => !!l.airtableContactId);
  const allPendingSelected =
    selectablePending.length > 0 &&
    selectablePending.every((l) => selectedPendingIds.has(l.id));
  const somePendingSelected =
    !allPendingSelected && selectablePending.some((l) => selectedPendingIds.has(l.id));

  function toggleAllPending() {
    if (allPendingSelected) {
      const next = new Set(selectedPendingIds);
      selectablePending.forEach((l) => next.delete(l.id));
      onPendingSelectionChange(next);
    } else {
      const next = new Set(selectedPendingIds);
      selectablePending.forEach((l) => next.add(l.id));
      onPendingSelectionChange(next);
    }
  }

  const isEmpty = launchedLeads.length === 0 && pendingLeads.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-medium">No leads</p>
        <p className="text-sm text-muted-foreground">This campaign has no leads</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-border">
          <TableHead className="w-10">
            {/* Pending section select-all is handled in group row */}
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Name</TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Company</TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Role</TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Status</TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Action</TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Sequence</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {/* -- Launched group -- */}
        <TableRow className="hover:bg-transparent border-t-2 border-t-slate-400 dark:border-t-slate-500">
          <TableCell className="w-10 py-3 px-3" />
          <TableCell colSpan={6} className="py-3 px-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-400 bg-teal-50 dark:bg-teal-950 dark:border-teal-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
              Launched
              <span className="font-normal normal-case tracking-normal">{launchedLeads.length}</span>
            </span>
          </TableCell>
        </TableRow>
        {sortedLaunched.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={7} className="py-3 px-3 text-xs text-muted-foreground italic">
              No launched leads
            </TableCell>
          </TableRow>
        ) : (
          sortedLaunched.map((lead) => {
            const isUnmatched = !lead.airtableContactId;
            return (
              <TableRow
                key={lead.id}
                onClick={
                  isUnmatched
                    ? undefined
                    : () => router.push(`/leads/${lead.id}?from=campaign-analysis&campaignId=${lead.campaignId}`)
                }
                className={cn(
                  isUnmatched ? "bg-muted/50 opacity-60" : "cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700",
                )}
              >
                <TableCell>
                  {/* Launched checkbox disabled */}
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
                    <Badge className="border-transparent bg-purple-500 text-white">No Match</Badge>
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
                  {(() => { const p = computeEffectiveDone(lead); return <SequenceBar step={p.done} total={p.total} />; })()}
                </TableCell>
              </TableRow>
            );
          })
        )}

        {/* -- To Launch group -- */}
        <TableRow className="hover:bg-transparent border-t-2 border-t-slate-400 dark:border-t-slate-500">
          <TableCell className="w-10 py-3 px-3">
            <Checkbox
              checked={allPendingSelected ? true : somePendingSelected ? "indeterminate" : false}
              onCheckedChange={toggleAllPending}
              aria-label="Select all pending"
              disabled={selectablePending.length === 0}
            />
          </TableCell>
          <TableCell colSpan={6} className="py-3 px-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400 bg-amber-50 dark:bg-amber-950 dark:border-amber-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              To Launch
              <span className="font-normal normal-case tracking-normal">{pendingLeads.length}</span>
            </span>
          </TableCell>
        </TableRow>
        {pendingLeads.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={7} className="py-3 px-3 text-xs text-muted-foreground italic">
              No pending leads
            </TableCell>
          </TableRow>
        ) : (
          pendingLeads.map((lead) => {
            const isSelected = selectedPendingIds.has(lead.id);
            return (
              <TableRow
                key={lead.id}
                onClick={() =>
                  router.push(
                    `/leads/${lead.airtableContactId}?campaignId=${lead.campaignId}&pending=1&from=campaign-analysis`
                  )
                }
                className={cn(
                  "cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700",
                  isSelected && "bg-blue-50/60 dark:bg-blue-950/20",
                )}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedPendingIds);
                      if (checked) next.add(lead.id);
                      else next.delete(lead.id);
                      onPendingSelectionChange(next);
                    }}
                    aria-label={`Select ${lead.contact?.name ?? lead.id}`}
                  />
                </TableCell>
                <TableCell>{lead.contact?.name ?? "—"}</TableCell>
                <TableCell>{lead.contact?.company ?? "—"}</TableCell>
                <TableCell>{lead.contact?.role ?? "—"}</TableCell>
                <TableCell>
                  <Badge className="border-transparent bg-amber-500 text-white">To Launch</Badge>
                </TableCell>
                <TableCell>
                  <Badge className="border border-amber-400 bg-transparent text-amber-700">Awaiting Launch</Badge>
                </TableCell>
                <TableCell>
                  {(() => { const p = computeEffectiveDone(lead); return <SequenceBar step={p.done} total={p.total} />; })()}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
