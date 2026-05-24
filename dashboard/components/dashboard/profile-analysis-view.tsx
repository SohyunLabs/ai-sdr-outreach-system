"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SequenceBar } from "@/components/dashboard/sequence-bar";
import { Header } from "@/components/layout/header";
import { getStatusColor } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Mail, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContactWithLeads, UnmatchedLead } from "@/lib/dashboard-utils";
import { selectPrimaryLead, formatSyncTimestamp } from "@/lib/dashboard-utils";

const PAGE_SIZE = 20;

interface ProfileAnalysisViewProps {
  contacts: ContactWithLeads[];
  unmatchedLeads: UnmatchedLead[];
  lastSyncAt: Date | null;
}

const STATUS_GROUPS = [
  { label: "전체", value: "all" },
  { label: "대기중", value: "waiting" },
  { label: "진행중", value: "active" },
  { label: "응답", value: "replied" },
  { label: "문제", value: "bounced" },
  { label: "기타", value: "other" },
  { label: "미배정", value: "unassigned" },
  { label: "매칭 실패", value: "unmatched" },
];

const STATE_LABELS: Record<string, string> = {
  // 대기중
  scanned: "대기중",
  reviewed: "검토됨",
  emailsSent: "이메일 발송",
  emailsOpened: "이메일 열람",
  linkedinVisitDone: "LinkedIn 방문",
  linkedinMessageSent: "LinkedIn 메시지",
  linkedinInviteSent: "LinkedIn 초대",
  // 응답/관심
  emailsReplied: "이메일 답장",
  linkedinInviteAccepted: "LinkedIn 수락",
  linkedinReplied: "LinkedIn 답장",
  interested: "관심",
  // 문제
  emailsBounced: "반송",
  emailsFailed: "발송 실패",
  unsubscribed: "수신 거부",
  notInterested: "미관심",
  // 완료/기타
  paused: "일시정지",
  done: "완료",
  skipped: "스킵",
  manual: "수동",
};

const WAITING_STATES = new Set(["scanned"]);
const ACTIVE_STATES = new Set(["reviewed", "emailsSent", "emailsOpened", "linkedinVisitDone", "linkedinMessageSent", "linkedinInviteSent"]);
const REPLIED_STATES = new Set(["emailsReplied", "linkedinInviteAccepted", "linkedinReplied", "interested"]);
const BOUNCED_STATES = new Set(["emailsBounced", "emailsFailed", "unsubscribed", "notInterested"]);

function matchesStatusGroup(state: string | null, group: string): boolean {
  if (group === "all") return true;
  if (group === "waiting") return WAITING_STATES.has(state ?? "");
  if (group === "active") return ACTIVE_STATES.has(state ?? "");
  if (group === "replied") return REPLIED_STATES.has(state ?? "");
  if (group === "bounced") return BOUNCED_STATES.has(state ?? "");
  if (group === "other") return !WAITING_STATES.has(state ?? "") && !ACTIVE_STATES.has(state ?? "") && !REPLIED_STATES.has(state ?? "") && !BOUNCED_STATES.has(state ?? "");
  return true;
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600 font-semibold";
  if (score >= 60) return "text-blue-600 font-semibold";
  if (score >= 40) return "text-yellow-600 font-semibold";
  return "text-red-600 font-semibold";
}

type TooltipState = {
  row: { contact: ContactWithLeads; primaryLead: ReturnType<typeof selectPrimaryLead>; isUnassigned: boolean };
  x: number;
  y: number;
} | null;

export function ProfileAnalysisView({ contacts, unmatchedLeads, lastSyncAt }: ProfileAnalysisViewProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusGroup, setStatusGroup] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [minScore, setMinScore] = useState("");
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    return contacts.map((c) => ({
      contact: c,
      primaryLead: selectPrimaryLead(c.leads),
      isUnassigned: c.leads.length === 0,
    }));
  }, [contacts]);

  const campaignOptions = useMemo(() => {
    const seen = new Map<string, string>();
    contacts.forEach((c) =>
      c.leads.forEach((l) => seen.set(l.campaignId, l.campaignName))
    );
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [contacts]);

  const filteredUnmatched = useMemo(() => {
    if (statusGroup !== "unmatched") return [];
    const q = search.toLowerCase().trim();
    return unmatchedLeads.filter((l) => {
      if (campaignFilter !== "all" && l.campaignId !== campaignFilter) return false;
      if (q && !l.lemlistLeadId.toLowerCase().includes(q) && !l.campaignName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [unmatchedLeads, statusGroup, search, campaignFilter]);

  const filtered = useMemo(() => {
    if (statusGroup === "unmatched") return [];
    const q = search.toLowerCase().trim();
    const min = minScore !== "" ? Number(minScore) : null;

    return rows.filter(({ contact, primaryLead, isUnassigned }) => {
      if (statusGroup === "unassigned") {
        if (!isUnassigned) return false;
      } else {
        if (statusGroup !== "all" && isUnassigned) return false;
        const state = primaryLead?.state ?? null;
        if (!matchesStatusGroup(state, statusGroup)) return false;
      }
      if (campaignFilter !== "all") {
        if (isUnassigned) return false;
        if (primaryLead?.campaignId !== campaignFilter) return false;
      }
      if (min !== null && (contact.aiScore ?? 0) < min) return false;
      if (q) {
        const haystack = [contact.name, contact.company, contact.role, contact.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusGroup, campaignFilter, minScore]);

  const displayList = statusGroup === "unmatched" ? filteredUnmatched : filtered;
  const displayCount = statusGroup === "unmatched" ? filteredUnmatched.length : filtered.length;
  const totalPages = Math.max(1, Math.ceil(displayCount / PAGE_SIZE));
  const paginated = displayList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filtered]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header title="Profile Analysis" />
      <div className="flex-1 overflow-y-auto bg-muted/40">
      <div className="px-8 py-8">

      {/* Filters + Sync */}
      <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <input
          type="text"
          placeholder="이름, 회사, 직책, 이메일 검색..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="h-8 w-56 rounded-md border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />

        {/* Status group tabs */}
        <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5">
          {STATUS_GROUPS.map((g) => (
            <button
              key={g.value}
              onClick={() => setStatusGroup(g.value)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                statusGroup === g.value
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Campaign filter */}
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="h-8 text-xs w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 캠페인</SelectItem>
            {campaignOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Min AI Score */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">AI 점수 최소</span>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="0"
            value={minScore}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinScore(e.target.value)}
            className="h-8 w-16 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <span className="text-xs text-muted-foreground">{displayCount}명</span>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums self-center">
        {formatSyncTimestamp(lastSyncAt)}
      </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[130px]" />
            <col className="w-[140px]" />
            <col className="w-[220px]" />
            <col className="w-[72px]" />
            <col className="w-[160px]" />
            <col className="w-[120px]" />
            <col className="w-[110px]" />
          </colgroup>
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">이름</th>
              <th className="px-4 py-2 text-left font-medium">회사</th>
              <th className="px-4 py-2 text-left font-medium">직책</th>
              <th className="px-4 py-2 text-left font-medium">AI 점수</th>
              <th className="px-4 py-2 text-left font-medium">캠페인</th>
              <th className="px-4 py-2 text-left font-medium">상태</th>
              <th className="px-4 py-2 text-left font-medium">시퀀스</th>
            </tr>
          </thead>
          <tbody>
            {displayCount === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  조건에 맞는 리드가 없습니다
                </td>
              </tr>
            ) : statusGroup === "unmatched" ? (
              (paginated as UnmatchedLead[]).map((lead) => (
                <tr key={lead.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground truncate">
                    {lead.lemlistLeadId}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">—</td>
                  <td className="px-4 py-2 text-muted-foreground">—</td>
                  <td className="px-4 py-2 text-muted-foreground">—</td>
                  <td className="px-4 py-2 text-xs truncate">{lead.campaignName}</td>
                  <td className="px-4 py-2">
                    <Badge className="text-xs font-normal border-0 bg-purple-500 text-white">매칭 실패</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">—</td>
                </tr>
              ))
            ) : (
              (paginated as typeof rows).map((row) => (
                <tr
                  key={row.contact.airtableId}
                  onClick={() => {
                    if (row.isUnassigned) {
                      router.push(`/contacts/${row.contact.airtableId}?from=profile-analysis`);
                    } else if (row.primaryLead) {
                      router.push(`/leads/${row.primaryLead.id}?from=profile-analysis`);
                    }
                  }}
                  onMouseEnter={(e) => setTooltip({ row, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                  className="border-b last:border-0 transition-colors cursor-pointer hover:bg-muted/50"
                >
                  <td className="px-4 py-2 font-medium truncate">
                    {row.contact.name ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2 truncate">
                    {row.contact.company ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2 truncate">
                    {row.contact.role ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span className={scoreColor(row.contact.aiScore)}>
                      {row.contact.aiScore != null ? row.contact.aiScore : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs truncate">
                    {row.isUnassigned
                      ? <span className="text-muted-foreground">—</span>
                      : (row.primaryLead?.campaignName ?? <span className="text-muted-foreground">—</span>)}
                  </td>
                  <td className="px-4 py-2">
                    {row.isUnassigned ? (
                      <Badge className="text-xs font-normal bg-gray-400 text-white border-0">미배정</Badge>
                    ) : row.primaryLead?.state ? (
                      <Badge className={cn("text-xs font-normal border-0", getStatusColor(row.primaryLead.state))}>
                        {STATE_LABELS[row.primaryLead.state] ?? row.primaryLead.state}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="flex items-center gap-1 px-1.5 py-0 text-xs h-5 shrink-0">
                        {row.contact.email ? (
                          <><Mail className="h-3 w-3" />이메일</>
                        ) : (
                          <><Linkedin className="h-3 w-3" />링크드인</>
                        )}
                      </Badge>
                      {!row.isUnassigned && row.primaryLead?.sequenceStep != null && row.primaryLead?.totalSequenceSteps != null && (
                        <SequenceBar step={row.primaryLead.sequenceStep} total={row.primaryLead.totalSequenceSteps} />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, displayCount)} / {displayCount}명
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {(() => {
              const pages: (number | "...")[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (page > 3) pages.push("...");
                for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                if (page < totalPages - 2) pages.push("...");
                pages.push(totalPages);
              }
              return pages.map((p, idx) =>
                p === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    className="h-7 w-7 p-0 text-xs"
                    onClick={() => setPage(p as number)}
                  >
                    {p}
                  </Button>
                )
              );
            })()}
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border bg-popover text-popover-foreground shadow-md p-3 w-60 text-xs space-y-1.5"
          style={{ left: tooltip.x + 14, top: tooltip.y - 8 }}
        >
          <p className="font-semibold text-sm truncate">{tooltip.row.contact.name ?? "—"}</p>
          {tooltip.row.contact.email && (
            <p className="text-muted-foreground truncate">{tooltip.row.contact.email}</p>
          )}
          {tooltip.row.contact.company && (
            <p className="truncate"><span className="text-muted-foreground">회사</span> {tooltip.row.contact.company}</p>
          )}
          {tooltip.row.contact.role && (
            <p className="truncate"><span className="text-muted-foreground">직책</span> {tooltip.row.contact.role}</p>
          )}
          <div className="flex items-center gap-3 pt-0.5">
            {tooltip.row.contact.aiScore != null && (
              <span className={cn("font-medium", scoreColor(tooltip.row.contact.aiScore))}>
                AI {tooltip.row.contact.aiScore}
              </span>
            )}
            <span className="text-muted-foreground">
              캠페인 {tooltip.row.contact.leads.length}개
            </span>
          </div>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
