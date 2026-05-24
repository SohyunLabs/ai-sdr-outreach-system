export const ACTIVITY_META: Record<string, { label: string; channel: "email" | "linkedin" | "system"; isInbound?: boolean }> = {
  // Email (Lemlist uses plural forms)
  emailsSent:             { label: "이메일 전송", channel: "email" },
  emailsOpened:           { label: "이메일 열람", channel: "email" },
  emailsClicked:          { label: "이메일 링크 클릭", channel: "email" },
  emailsReplied:          { label: "이메일 회신 수신", channel: "email", isInbound: true },
  emailsBounced:          { label: "이메일 반송", channel: "email" },
  emailsFailed:           { label: "이메일 발송 실패", channel: "email" },
  // LinkedIn (type names TBD — will confirm once Phase 2/3 campaign has activity data)
  linkedinSent:           { label: "LinkedIn 메시지 전송", channel: "linkedin" },
  linkedinOpened:         { label: "LinkedIn 메시지 열람", channel: "linkedin" },
  linkedinReplied:        { label: "LinkedIn 답장 수신", channel: "linkedin", isInbound: true },
  linkedinVisit:          { label: "LinkedIn 프로필 방문", channel: "linkedin" },
  linkedinInviteDone:     { label: "LinkedIn 일촌 신청", channel: "linkedin" },
  linkedinConnect:        { label: "LinkedIn 일촌 신청", channel: "linkedin" },
  linkedinInviteAccepted: { label: "LinkedIn 일촌 수락", channel: "linkedin", isInbound: true },
  // System
  paused:                 { label: "시퀀스 일시정지", channel: "system" },
  resumed:                { label: "시퀀스 재개", channel: "system" },
  apiUnsubscribed:        { label: "수신 거부", channel: "system" },
  conditionChosen:        { label: "분기 선택", channel: "system" },
  variableSubscribed:     { label: "변수 설정", channel: "system" },
  contactSkipped:         { label: "건너뜀", channel: "system" },
};

export interface ActivityItem {
  id: string;
  type: string;
  occurredAt: Date;
  content?: string | null;
  campaignName?: string;
  campaignId?: string;
  sequenceStep?: number | null;
  sentOutside?: boolean;
}

export interface MessageForActivity {
  m1Subject?: string | null;
  m1BodyEmail?: string | null;
  m1BodyLi?: string | null;
  m2Subject?: string | null;
  m2BodyEmail?: string | null;
  m2BodyLi?: string | null;
  m3Subject?: string | null;
  m3BodyEmail?: string | null;
  m3BodyLi?: string | null;
  m4LiConnReq?: string | null;
  m5LiChat?: string | null;
  m6Subject?: string | null;
  m6BodyEmail?: string | null;
  m6BodyLi?: string | null;
}

const BR_RE = /<br\s*\/?>/gi;
const clean = (s: string | null | undefined) => s?.replace(BR_RE, "\n").replace(/&nbsp;/g, " ") ?? null;

/** sequenceStep 기반 본문 조회 (레거시, 아래 getBodyByLabel 사용 권장) */
export function getBodyForSentActivity(
  type: string,
  step: number | null | undefined,
  msg: MessageForActivity | null
): { subject: string | null; body: string | null } {
  if (!msg) return { subject: null, body: null };

  if (type === "emailsSent") {
    if (step === 1) return { subject: msg.m1Subject ?? null, body: clean(msg.m1BodyEmail) };
    if (step === 2) return {
      subject: msg.m2Subject ?? msg.m3Subject ?? null,
      body: clean(msg.m2BodyEmail ?? msg.m3BodyEmail),
    };
    return { subject: msg.m6Subject ?? null, body: clean(msg.m6BodyEmail) };
  }
  if (type === "linkedinSent") return { subject: null, body: msg.m5LiChat ?? null };
  if (type === "linkedinConnect") return { subject: null, body: msg.m4LiConnReq ?? null };

  return { subject: null, body: null };
}

/**
 * 활동 타입의 시간순 순서로 M1~M6 레이블 도출.
 * Lemlist sequenceStep 숫자에 의존하지 않음.
 *
 * 이메일 시퀀스:
 *   1번째 emailSent → M1
 *   emailOpened 있으면 2번째 emailSent → M2, 없으면 → M3
 *   3번째 emailSent → M6
 *   linkedinConnect → M4 (LinkedIn 일촌 신청)
 *   linkedinSent → M5
 *
 * LinkedIn-only 시퀀스:
 *   linkedinConnect → M4
 *   inviteAccepted 있으면: 1st linkedinSent → M5, 2nd → M1, 3rd → M2, 4th → M6
 *   inviteAccepted 없으면: 1st → M1, 2nd → M2, 3rd → M6
 *
 * Returns Map<messageLabel, sentDate>
 */
export function deriveCompletedActivities(
  activities: Pick<ActivityItem, "id" | "type" | "occurredAt" | "sentOutside">[],
  hasEmail: boolean
): Map<string, Date> {
  const sorted = [...activities].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );
  const result = new Map<string, Date>();

  // 첫 번째 답장 이후 아웃바운드 메시지는 수동 발송 — 시퀀스 단계로 미포함
  const firstReply = sorted.find(a => a.type === "linkedinReplied" || a.type === "emailsReplied");
  const cutoff = firstReply ? new Date(firstReply.occurredAt).getTime() : Infinity;

  const emailSents = sorted.filter(a => a.type === "emailsSent" && new Date(a.occurredAt).getTime() <= cutoff);
  const linkedinSents = sorted.filter(a => a.type === "linkedinSent" && !a.sentOutside && new Date(a.occurredAt).getTime() <= cutoff);
  const linkedinConnects = sorted.filter(a => a.type === "linkedinConnect" || a.type === "linkedinInviteDone");
  const wasOpened = sorted.some(a => a.type === "emailsOpened");
  const inviteAccepted = sorted.some(a => a.type === "linkedinInviteAccepted");
  const inviteAcceptedActivity = sorted.find(a => a.type === "linkedinInviteAccepted");

  if (hasEmail) {
    if (emailSents[0]) result.set("M1", new Date(emailSents[0].occurredAt));
    if (emailSents[1]) result.set(wasOpened ? "M2" : "M3", new Date(emailSents[1].occurredAt));
    if (emailSents[2]) result.set("M6", new Date(emailSents[2].occurredAt));
    if (linkedinSents[0]) result.set("M5", new Date(linkedinSents[0].occurredAt));
  } else {
    // LinkedIn-only sequence
    if (inviteAccepted) {
      if (linkedinSents[0]) result.set("M5", new Date(linkedinSents[0].occurredAt));
      if (linkedinSents[1]) result.set("M1", new Date(linkedinSents[1].occurredAt));
      if (linkedinSents[2]) result.set("M2", new Date(linkedinSents[2].occurredAt));
      if (linkedinSents[3]) result.set("M6", new Date(linkedinSents[3].occurredAt));
    } else {
      if (linkedinSents[0]) result.set("M1", new Date(linkedinSents[0].occurredAt));
      if (linkedinSents[1]) result.set("M2", new Date(linkedinSents[1].occurredAt));
      if (linkedinSents[2]) result.set("M6", new Date(linkedinSents[2].occurredAt));
    }
  }

  if (linkedinConnects[0]) result.set("LinkedIn 일촌 신청", new Date(linkedinConnects[0].occurredAt));
  if (inviteAcceptedActivity) result.set("LinkedIn 일촌 수락", new Date(inviteAcceptedActivity.occurredAt));

  return result;
}

/** 특정 activity의 메시지 레이블 반환 (e.g. "M1", "M2", "M4") */
export function getActivityMessageLabel(
  activityId: string,
  activities: Pick<ActivityItem, "id" | "type" | "occurredAt" | "sentOutside">[],
  hasEmail: boolean
): string | null {
  const sorted = [...activities].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );
  const activity = activities.find(a => a.id === activityId);
  if (!activity) return null;

  // 첫 번째 답장 이후 아웃바운드 메시지는 수동 발송 — 시퀀스 단계로 미포함
  const firstReply = sorted.find(a => a.type === "linkedinReplied" || a.type === "emailsReplied");
  const cutoff = firstReply ? new Date(firstReply.occurredAt).getTime() : Infinity;

  const emailSents = sorted.filter(a => a.type === "emailsSent" && new Date(a.occurredAt).getTime() <= cutoff);
  const linkedinSents = sorted.filter(a => a.type === "linkedinSent" && !a.sentOutside && new Date(a.occurredAt).getTime() <= cutoff);
  const wasOpened = sorted.some(a => a.type === "emailsOpened");
  const inviteAccepted = sorted.some(a => a.type === "linkedinInviteAccepted");

  if (activity.type === "emailsSent") {
    const idx = emailSents.findIndex(a => a.id === activityId);
    if (idx === 0) return "M1";
    if (idx === 1) return wasOpened ? "M2" : "M3";
    if (idx >= 2) return "M6";
  }
  if (activity.type === "linkedinConnect" || activity.type === "linkedinInviteDone") return "M4";
  if (activity.type === "linkedinSent") {
    if (hasEmail) return "M5";
    const idx = linkedinSents.findIndex(a => a.id === activityId);
    if (inviteAccepted) {
      if (idx === 0) return "M5";
      if (idx === 1) return "M1";
      if (idx === 2) return "M2";
      if (idx >= 3) return "M6";
    } else {
      if (idx === 0) return "M1";
      if (idx === 1) return "M2";
      if (idx >= 2) return "M6";
    }
  }
  return null;
}

/** 레이블(M1~M6)로 메시지 본문/제목 반환.
 *  channel="linkedin"이면 LI body 우선, 없으면 email body fallback */
export function getBodyByLabel(
  label: string | null,
  msg: MessageForActivity | null,
  channel?: "email" | "linkedin" | "system"
): { subject: string | null; body: string | null } {
  if (!label || !msg) return { subject: null, body: null };
  const li = channel === "linkedin";
  switch (label) {
    case "M1": return { subject: msg.m1Subject ?? null, body: clean(li ? (msg.m1BodyLi ?? msg.m1BodyEmail) : msg.m1BodyEmail) };
    case "M2": return { subject: msg.m2Subject ?? null, body: clean(li ? (msg.m2BodyLi ?? msg.m2BodyEmail) : msg.m2BodyEmail) };
    case "M3": return { subject: msg.m3Subject ?? null, body: clean(li ? (msg.m3BodyLi ?? msg.m3BodyEmail) : msg.m3BodyEmail) };
    case "M4": return { subject: null, body: msg.m4LiConnReq ?? null };
    case "M5": return { subject: null, body: msg.m5LiChat ?? null };
    case "M6": return { subject: msg.m6Subject ?? null, body: clean(li ? (msg.m6BodyLi ?? msg.m6BodyEmail) : msg.m6BodyEmail) };
    default: return { subject: null, body: null };
  }
}

// Groups activities by calendar date, sorted ascending (oldest first).
// Items within each date are also sorted ascending.
export function groupActivitiesByDate(activities: ActivityItem[]): { date: string; items: ActivityItem[] }[] {
  const map = new Map<string, ActivityItem[]>();
  for (const item of activities) {
    const d = item.occurredAt instanceof Date ? item.occurredAt : new Date(item.occurredAt);
    const key = d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    const existing = map.get(key) ?? [];
    existing.push(item);
    map.set(key, existing);
  }
  return Array.from(map.entries())
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()),
    }))
    .sort((a, b) => new Date(a.items[0].occurredAt).getTime() - new Date(b.items[0].occurredAt).getTime());
}

export const STEP_META = [
  { index: 0, label: "M1", channel: "email" as const },
  { index: 1, label: "M2", channel: "email" as const },
  { index: 2, label: "M3", channel: "email" as const },
  { index: 3, label: "M4", channel: "linkedin" as const },
  { index: 4, label: "M5", channel: "linkedin" as const },
  { index: 5, label: "M6", channel: "email" as const },
];

export function formatActivityTimestamp(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${m}`;
}

interface MessageRecord {
  m1Subject?: string | null;
  m1BodyEmail?: string | null;
  m1BodyLi?: string | null;
  m2Subject?: string | null;
  m2BodyEmail?: string | null;
  m2BodyLi?: string | null;
  m3Subject?: string | null;
  m3BodyEmail?: string | null;
  m3BodyLi?: string | null;
  m4LiConnReq?: string | null;
  m5LiChat?: string | null;
  m6Subject?: string | null;
  m6BodyEmail?: string | null;
  m6BodyLi?: string | null;
}

export function buildSteps(message: MessageRecord | null): Array<{
  index: number;
  label: string;
  channel: "email" | "linkedin";
  subject: string | null;
  body: string | null;
}> {
  return [
    {
      ...STEP_META[0],
      subject: message?.m1Subject ?? null,
      body: message?.m1BodyEmail ?? null,
    },
    {
      ...STEP_META[1],
      subject: message?.m2Subject ?? null,
      body: message?.m2BodyEmail ?? null,
    },
    {
      ...STEP_META[2],
      subject: message?.m3Subject ?? null,
      body: message?.m3BodyEmail ?? null,
    },
    {
      ...STEP_META[3],
      subject: message ? "LinkedIn 연결 요청" : null,
      body: null,
    },
    {
      ...STEP_META[4],
      subject: message ? "LinkedIn 채팅" : null,
      body: message?.m5LiChat ?? null,
    },
    {
      ...STEP_META[5],
      subject: message?.m6Subject ?? null,
      body: message?.m6BodyEmail ?? null,
    },
  ];
}

const SENT_ACTIVITY_TYPES = new Set(["emailsSent", "linkedinSent"]);

export function deriveSentSteps(
  activities: { type: string; sequenceStep: number | null }[]
): Set<number> {
  const sent = new Set<number>();
  for (const activity of activities) {
    if (SENT_ACTIVITY_TYPES.has(activity.type) && activity.sequenceStep !== null) {
      sent.add(activity.sequenceStep);
    }
  }
  return sent;
}

// ─── 분기형 시퀀스 플로우 ───────────────────────────────────────────

export interface FlowStepData {
  label: string;
  channel: "email" | "linkedin";
  subject: string | null;
  body: string | null;
  day?: number;
  subjectKey?: string;
  bodyKey?: string;
}

export interface FlowBranchData {
  conditionLabel: string;
  day?: number;
  branches: {
    label: string;
    deciderLabels?: string[]; // 이 레이블 중 하나라도 sent이면 이 분기가 활성
    steps: FlowNode[];
  }[];
}

export type FlowNode =
  | { type: "step"; data: FlowStepData }
  | { type: "branch"; data: FlowBranchData };

export function buildEmailSequence(message: MessageRecord | null): FlowNode[] {
  return [
    {
      type: "step",
      data: { label: "M1", channel: "email", subject: message?.m1Subject ?? null, body: message?.m1BodyEmail ?? null, day: 0, subjectKey: "m1Subject", bodyKey: "m1BodyEmail" },
    },
    {
      type: "branch",
      data: {
        conditionLabel: "M1 오픈 여부",
        day: 3,
        branches: [
          {
            label: "오픈 시",
            deciderLabels: ["M2"],
            steps: [
              { type: "step", data: { label: "M2", channel: "email", subject: message?.m2Subject ?? null, body: message?.m2BodyEmail ?? null, subjectKey: "m2Subject", bodyKey: "m2BodyEmail" } },
              { type: "step", data: { label: "LinkedIn 일촌 신청", channel: "linkedin", subject: "일촌 신청 (메시지 없음)", body: null, bodyKey: "m4LiConnReq" } },
            ],
          },
          {
            label: "미오픈 시",
            deciderLabels: ["M3"],
            steps: [
              { type: "step", data: { label: "M3", channel: "email", subject: message?.m3Subject ?? null, body: message?.m3BodyEmail ?? null, subjectKey: "m3Subject", bodyKey: "m3BodyEmail" } },
              { type: "step", data: { label: "LinkedIn 일촌 신청", channel: "linkedin", subject: "일촌 신청 (메시지 없음)", body: null, bodyKey: "m4LiConnReq" } },
            ],
          },
        ],
      },
    },
    {
      type: "branch",
      data: {
        conditionLabel: "LinkedIn 일촌 수락 여부",
        day: 5,
        branches: [
          {
            label: "수락 시",
            deciderLabels: ["M5"],
            steps: [
              { type: "step", data: { label: "M5", channel: "linkedin", subject: message?.m5LiChat ? message.m5LiChat.slice(0, 40) + (message.m5LiChat.length > 40 ? "…" : "") : null, body: message?.m5LiChat ?? null, bodyKey: "m5LiChat" } },
            ],
          },
          {
            label: "미수락 시",
            deciderLabels: [],
            steps: [],
          },
        ],
      },
    },
    {
      type: "step",
      data: { label: "M6", channel: "email", subject: message?.m6Subject ?? null, body: message?.m6BodyEmail ?? null, day: 8, subjectKey: "m6Subject", bodyKey: "m6BodyEmail" },
    },
  ];
}

export function buildLinkedinSequence(message: MessageRecord | null): FlowNode[] {
  return [
    {
      type: "step",
      data: { label: "LinkedIn 일촌 신청", channel: "linkedin", subject: "일촌 신청 (메시지 없음)", body: null, day: 0, bodyKey: "m4LiConnReq" },
    },
    {
      type: "branch",
      data: {
        conditionLabel: "LinkedIn 일촌 수락 여부",
        day: 2,
        branches: [
          {
            label: "수락 시",
            deciderLabels: ["M5"],
            steps: [
              { type: "step", data: { label: "M5", channel: "linkedin", subject: message?.m5LiChat ? message.m5LiChat.slice(0, 40) + (message.m5LiChat.length > 40 ? "…" : "") : null, body: message?.m5LiChat ?? null, day: 2, bodyKey: "m5LiChat" } },
              { type: "step", data: { label: "M1", channel: "linkedin", subject: message?.m1Subject ?? null, body: message?.m1BodyLi ?? null, day: 5, bodyKey: "m1BodyLi" } },
              { type: "step", data: { label: "M2", channel: "linkedin", subject: message?.m2Subject ?? null, body: message?.m2BodyLi ?? null, day: 8, bodyKey: "m2BodyLi" } },
              { type: "step", data: { label: "M6", channel: "linkedin", subject: message?.m6Subject ?? null, body: message?.m6BodyLi ?? null, day: 14, bodyKey: "m6BodyLi" } },
            ],
          },
          {
            label: "미수락 시",
            deciderLabels: [],
            steps: [
              { type: "step", data: { label: "M1", channel: "linkedin", subject: message?.m1Subject ?? null, body: message?.m1BodyLi ?? null, day: 2, bodyKey: "m1BodyLi" } },
              { type: "step", data: { label: "M2", channel: "linkedin", subject: message?.m2Subject ?? null, body: message?.m2BodyLi ?? null, day: 5, bodyKey: "m2BodyLi" } },
              { type: "step", data: { label: "M6", channel: "linkedin", subject: message?.m6Subject ?? null, body: message?.m6BodyLi ?? null, day: 8, bodyKey: "m6BodyLi" } },
            ],
          },
        ],
      },
    },
  ];
}
