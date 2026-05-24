import { WAITING_STATES, BLUE_STATES, GREEN_STATES, RED_STATES, NEUTRAL_STATES } from "@/lib/status-colors";

export interface CampaignLeadWithContact {
  id: string;
  lemlistLeadId: string;
  campaignId: string;
  airtableContactId: string | null;
  state: string | null;
  lemlistStatus: string | null;
  campaignStatus?: string | null;
  sequenceStep: number | null;
  totalSequenceSteps: number | null;
  sequenceType: string | null;
  activities: { id: string; type: string; occurredAt: Date; sequenceStep: number | null; totalSequenceSteps: number | null }[];
  contact: {
    airtableId: string;
    name: string | null;
    company: string | null;
    role: string | null;
    aiScore: number | null;
    email: string | null;
  } | null;
}

export interface CampaignWithLeads {
  id: string;
  name: string;
  status: string | null;
  leads: CampaignLeadWithContact[];
}

export interface CampaignSummary {
  total: number;
  waiting: number;
  inProgress: number;
  ended: number;
  responded: number;
  failed: number;
  neutral: number;
  liAccepted: number;
  liAcceptedCount: number;
  liInvited: number;
  openRate: number;
  openCount: number;
  replyRate: number;
  replyCount: number;
  bounceRate: number;
  bounceCount: number;
  messageSentCount: number;
}

export function isSequenceComplete(l: CampaignLeadWithContact): boolean {
  if (GREEN_STATES.has(l.state ?? "") || RED_STATES.has(l.state ?? "")) return false;
  return l.lemlistStatus === "done" || l.campaignStatus === "ended" || l.campaignStatus === "paused";
}

export function computeSummary(leads: CampaignLeadWithContact[]): CampaignSummary {
  const responded = leads.filter((l) => GREEN_STATES.has(l.state ?? "")).length;
  const failed = leads.filter((l) => RED_STATES.has(l.state ?? "")).length;
  const neutral = leads.filter(
    (l) => NEUTRAL_STATES.has(l.state ?? "") || isSequenceComplete(l)
  ).length;

  const liInvited = leads.filter((l) =>
    l.activities.some((a) => a.type === "linkedinInviteDone")
  ).length;
  const liAcceptedCount = leads.filter((l) =>
    l.activities.some((a) => a.type === "linkedinInviteAccepted")
  ).length;
  const liAccepted = liInvited > 0 ? Math.round((liAcceptedCount / liInvited) * 100) : 0;

  const messageSentCount = leads.filter((l) =>
    l.activities.some((a) => a.type === "emailsSent" || a.type === "linkedinSent")
  ).length;
  const openCount = leads.filter((l) =>
    l.activities.some((a) => a.type === "emailsOpened" || a.type === "linkedinOpened")
  ).length;
  const replyCount = leads.filter((l) =>
    l.activities.some((a) => a.type === "emailsReplied" || a.type === "linkedinReplied")
  ).length;
  const bounceCount = leads.filter((l) =>
    l.activities.some((a) => a.type === "emailsBounced" || a.type === "emailsFailed" || a.type === "linkedinSendFailed")
  ).length;

  const openRate = messageSentCount > 0 ? Math.round((openCount / messageSentCount) * 100) : 0;
  const replyRate = messageSentCount > 0 ? Math.round((replyCount / messageSentCount) * 100) : 0;
  const bounceRate = messageSentCount > 0 ? Math.round((bounceCount / messageSentCount) * 100) : 0;

  return {
    total: leads.length,
    waiting: leads.filter((l) => WAITING_STATES.has(l.state ?? "")).length,
    inProgress: leads.filter((l) => BLUE_STATES.has(l.state ?? "") && !isSequenceComplete(l)).length,
    ended: responded + failed + neutral,
    responded,
    failed,
    neutral,
    liAccepted,
    liAcceptedCount,
    liInvited,
    openRate,
    openCount,
    replyRate,
    replyCount,
    bounceRate,
    bounceCount,
    messageSentCount,
  };
}

export function formatSyncTimestamp(date: Date | null): string {
  if (!date) return "동기화 기록 없음";
  const mo = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `마지막 동기화: ${mo}/${d} ${h}:${m}`;
}

// --- Unmatched leads ---

export interface UnmatchedLead {
  id: string;
  lemlistLeadId: string;
  campaignId: string;
  campaignName: string;
  state: string | null;
}

// --- Phase 6: Contact-centric types ---

export interface ContactLeadSummary {
  id: string;
  campaignId: string;
  campaignName: string;
  state: string | null;
  sequenceStep: number | null;
  totalSequenceSteps: number | null;
}

export interface ContactWithLeads {
  airtableId: string;
  name: string | null;
  company: string | null;
  role: string | null;
  aiScore: number | null;
  email: string | null;
  leads: ContactLeadSummary[]; // 빈 배열 = 미배정
}

/**
 * active/inProgress 상태(BLUE_STATES) 최우선 반환.
 * 없으면 leads[0] 반환. 빈 배열이면 null.
 * CAMP-01, CAMP-02 요건 구현.
 */
export function selectPrimaryLead(
  leads: ContactLeadSummary[]
): ContactLeadSummary | null {
  if (leads.length === 0) return null;
  const active = leads.find((l) => BLUE_STATES.has(l.state ?? ""));
  return active ?? leads[0];
}
