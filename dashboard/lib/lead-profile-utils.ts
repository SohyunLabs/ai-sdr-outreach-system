export const ACTIVITY_META: Record<string, { label: string; channel: "email" | "linkedin" | "system"; isInbound?: boolean }> = {
  // Email (Lemlist uses plural forms)
  emailsSent:             { label: "Email Sent", channel: "email" },
  emailsOpened:           { label: "Email Opened", channel: "email" },
  emailsClicked:          { label: "Email Link Clicked", channel: "email" },
  emailsReplied:          { label: "Email Reply Received", channel: "email", isInbound: true },
  emailsBounced:          { label: "Email Bounced", channel: "email" },
  emailsFailed:           { label: "Email Send Failed", channel: "email" },
  // LinkedIn
  linkedinSent:           { label: "LinkedIn Message Sent", channel: "linkedin" },
  linkedinOpened:         { label: "LinkedIn Message Opened", channel: "linkedin" },
  linkedinReplied:        { label: "LinkedIn Reply Received", channel: "linkedin", isInbound: true },
  linkedinVisit:          { label: "LinkedIn Profile Visit", channel: "linkedin" },
  linkedinInviteDone:     { label: "LinkedIn Invite Sent", channel: "linkedin" },
  linkedinConnect:        { label: "LinkedIn Invite Sent", channel: "linkedin" },
  linkedinInviteAccepted: { label: "LinkedIn Invite Accepted", channel: "linkedin", isInbound: true },
  // System
  paused:                 { label: "Sequence Paused", channel: "system" },
  resumed:                { label: "Sequence Resumed", channel: "system" },
  apiUnsubscribed:        { label: "Unsubscribed", channel: "system" },
  conditionChosen:        { label: "Branch Selected", channel: "system" },
  variableSubscribed:     { label: "Variable Set", channel: "system" },
  contactSkipped:         { label: "Skipped", channel: "system" },
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

/** Lookup body by sequenceStep (legacy, prefer getBodyByLabel below) */
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
 * Derives M1-M6 labels from chronological activity order.
 * Does not depend on Lemlist sequenceStep numbers.
 *
 * Email sequence:
 *   1st emailSent -> M1
 *   if emailOpened, 2nd emailSent -> M2, otherwise -> M3
 *   3rd emailSent -> M6
 *   linkedinConnect -> M4 (LinkedIn invite)
 *   linkedinSent -> M5
 *
 * LinkedIn-only sequence:
 *   linkedinConnect -> M4
 *   if inviteAccepted: 1st linkedinSent -> M5, 2nd -> M1, 3rd -> M2, 4th -> M6
 *   if not accepted: 1st -> M1, 2nd -> M2, 3rd -> M6
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

  // Outbound messages after first reply are manual sends -- excluded from sequence labels
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

  if (linkedinConnects[0]) result.set("LinkedIn Invite", new Date(linkedinConnects[0].occurredAt));
  if (inviteAcceptedActivity) result.set("LinkedIn Accepted", new Date(inviteAcceptedActivity.occurredAt));

  return result;
}

/** Returns the message label for a specific activity (e.g. "M1", "M2", "M4") */
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

  // Outbound messages after first reply are manual sends -- excluded from sequence labels
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

/** Returns message body/subject by label (M1-M6).
 *  If channel="linkedin", LI body is preferred with email body fallback. */
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
    const key = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
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
      subject: message ? "LinkedIn Connection Request" : null,
      body: null,
    },
    {
      ...STEP_META[4],
      subject: message ? "LinkedIn Chat" : null,
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

// --- Branching sequence flow ---

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
    deciderLabels?: string[]; // if any of these labels are sent, this branch is active
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
        conditionLabel: "M1 Open Status",
        day: 3,
        branches: [
          {
            label: "If Opened",
            deciderLabels: ["M2"],
            steps: [
              { type: "step", data: { label: "M2", channel: "email", subject: message?.m2Subject ?? null, body: message?.m2BodyEmail ?? null, subjectKey: "m2Subject", bodyKey: "m2BodyEmail" } },
              { type: "step", data: { label: "LinkedIn Invite", channel: "linkedin", subject: "Invite (no message)", body: null, bodyKey: "m4LiConnReq" } },
            ],
          },
          {
            label: "If Not Opened",
            deciderLabels: ["M3"],
            steps: [
              { type: "step", data: { label: "M3", channel: "email", subject: message?.m3Subject ?? null, body: message?.m3BodyEmail ?? null, subjectKey: "m3Subject", bodyKey: "m3BodyEmail" } },
              { type: "step", data: { label: "LinkedIn Invite", channel: "linkedin", subject: "Invite (no message)", body: null, bodyKey: "m4LiConnReq" } },
            ],
          },
        ],
      },
    },
    {
      type: "branch",
      data: {
        conditionLabel: "LinkedIn Invite Accepted",
        day: 5,
        branches: [
          {
            label: "If Accepted",
            deciderLabels: ["M5"],
            steps: [
              { type: "step", data: { label: "M5", channel: "linkedin", subject: message?.m5LiChat ? message.m5LiChat.slice(0, 40) + (message.m5LiChat.length > 40 ? "…" : "") : null, body: message?.m5LiChat ?? null, bodyKey: "m5LiChat" } },
            ],
          },
          {
            label: "If Not Accepted",
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
      data: { label: "LinkedIn Invite", channel: "linkedin", subject: "Invite (no message)", body: null, day: 0, bodyKey: "m4LiConnReq" },
    },
    {
      type: "branch",
      data: {
        conditionLabel: "LinkedIn Invite Accepted",
        day: 2,
        branches: [
          {
            label: "If Accepted",
            deciderLabels: ["M5"],
            steps: [
              { type: "step", data: { label: "M5", channel: "linkedin", subject: message?.m5LiChat ? message.m5LiChat.slice(0, 40) + (message.m5LiChat.length > 40 ? "…" : "") : null, body: message?.m5LiChat ?? null, day: 2, bodyKey: "m5LiChat" } },
              { type: "step", data: { label: "M1", channel: "linkedin", subject: message?.m1Subject ?? null, body: message?.m1BodyLi ?? null, day: 5, bodyKey: "m1BodyLi" } },
              { type: "step", data: { label: "M2", channel: "linkedin", subject: message?.m2Subject ?? null, body: message?.m2BodyLi ?? null, day: 8, bodyKey: "m2BodyLi" } },
              { type: "step", data: { label: "M6", channel: "linkedin", subject: message?.m6Subject ?? null, body: message?.m6BodyLi ?? null, day: 14, bodyKey: "m6BodyLi" } },
            ],
          },
          {
            label: "If Not Accepted",
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
