function getBotToken() { return process.env.SLACK_BOT_TOKEN ?? ""; }
function getDefaultChannel() { return process.env.SLACK_CHANNEL_ID ?? ""; }

function isConfigured(): boolean {
  return Boolean(getBotToken() && getDefaultChannel());
}

// ── Channel routing ──────────────────────────────────────────────────────────

const KOREA_COUNTRIES = new Set(["Korea Republic of"]);
const JAPAN_COUNTRIES = new Set(["Japan"]);
const APAC_COUNTRIES = new Set([
  "Thailand", "Indonesia", "Guam", "Hong Kong", "India", "Malaysia",
  "Cambodia", "Philippines", "Viet Nam", "China", "Australia", "Singapore",
  "Taiwan", "Bangladesh", "New Zealand", "Sri Lanka", "Fiji", "Laos",
  "Myanmar", "Mongolia", "Brunei Darussalam", "Timor-Leste", "Papua New Guinea",
  "Solomon Islands", "Vanuatu", "New Caledonia", "Bhutan", "Nepal",
  "Uzbekistan", "Kyrgyzstan", "Kazakhstan", "Turkmenistan", "Pakistan",
]);
const EMEA_COUNTRIES = new Set([
  "Croatia", "Spain", "Albania", "Turkey", "Ireland", "Montenegro", "Azerbaijan",
  "Morocco", "Portugal", "Netherlands", "Switzerland", "Bulgaria", "Georgia",
  "Serbia", "Tanzania", "Estonia", "Cyprus", "Bosnia and Herzegovina", "Italy",
  "Germany", "France", "Slovenia", "Slovakia", "Algeria", "Belarus", "Israel",
  "Ukraine", "Iceland", "Russia", "Finland", "Poland", "Luxembourg", "Belgium",
  "Greece", "Romania", "Lithuania", "United Arab Emirates", "Kuwait", "Denmark",
  "North Macedonia", "Malta", "Norway", "South Africa", "Tunisia", "Ghana",
  "Saudi Arabia", "Latvia", "Armenia", "Republic of the Congo", "Iran", "Libya",
  "Czech Republic", "United Kingdom", "Nigeria", "Senegal", "Benin", "Egypt",
  "Jordan", "Gibraltar", "Andorra", "Bahrain", "Yemen", "Guinea", "Mali",
  "Rwanda", "Liberia", "Mauritius", "Kosovo", "Qatar", "Hungary", "Zimbabwe",
  "Ethiopia", "Cameroon", "Kenya", "Austria", "Sweden",
]);
const NAM_COUNTRIES = new Set([
  "United States", "Canada", "Mexico", "Brazil", "Argentina", "Colombia",
  "Chile", "Peru", "Venezuela", "Ecuador", "Bolivia", "Paraguay", "Uruguay",
  "Panama", "Costa Rica", "Guatemala", "Honduras", "El Salvador", "Nicaragua",
  "Dominican Republic", "Cuba", "Jamaica", "Trinidad and Tobago", "Puerto Rico",
  "Bahamas", "Barbados", "Haiti", "Guyana", "Belize",
]);

/** Returns the Slack channel ID for a given country. Falls back to default channel if not set. */
export function resolveChannel(country?: string | null): string {
  const defaultCh = getDefaultChannel();
  if (country) {
    if (KOREA_COUNTRIES.has(country)) return process.env.SLACK_CHANNEL_KR || defaultCh;
    if (JAPAN_COUNTRIES.has(country)) return process.env.SLACK_CHANNEL_JP || defaultCh;
    if (APAC_COUNTRIES.has(country)) return process.env.SLACK_CHANNEL_APAC || defaultCh;
    if (EMEA_COUNTRIES.has(country)) return process.env.SLACK_CHANNEL_EMEA || defaultCh;
    if (NAM_COUNTRIES.has(country)) return process.env.SLACK_CHANNEL_NAM || defaultCh;
  }
  return defaultCh;
}

// ── Slack API ────────────────────────────────────────────────────────────────

async function slackPost(
  method: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getBotToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!data.ok) throw new Error(`Slack ${method}: ${String(data.error)}`);
  return data;
}

// ── Formatting helpers ───────────────────────────────────────────────────────

function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function formatKST(date: Date | string): string {
  return new Date(date).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SKIP_TYPES = new Set(["conditionChosen", "campaignStepStarted", "skipped", "paused", "resumed"]);

const ACTIVITY_INFO: Record<string, { label: string; needsAttention?: boolean; note?: string }> = {
  emailsSent:             { label: "이메일 발송" },
  emailsOpened:           { label: "이메일 열람" },
  emailsReplied:          { label: "이메일 회신 수신" },
  emailsBounced:          { label: "이메일 반송", needsAttention: true, note: "이메일이 반송되었습니다. 이메일 주소를 확인하거나 다른 채널로 전환하는 것을 권장합니다." },
  linkedinConnect:        { label: "LinkedIn 일촌 신청" },
  linkedinInviteDone:     { label: "LinkedIn 일촌 신청" },
  linkedinInviteAccepted: { label: "LinkedIn 일촌 수락" },
  linkedinSent:           { label: "LinkedIn 메시지 발송" },
  linkedinReplied:        { label: "LinkedIn 답장 수신" },
  linkedinVisit:          { label: "LinkedIn 프로필 방문" },
  linkedinOpened:         { label: "LinkedIn 메시지 열람" },
  linkedinSendFailed:     { label: "LinkedIn 발송 실패", needsAttention: true, note: "LinkedIn 메시지 발송에 실패했습니다. 연결 상태 및 계정 한도를 확인해 주세요." },
  apiUnsubscribed:        { label: "수신 거부", needsAttention: true, note: "리드가 수신 거부를 요청했습니다. 즉시 후속 발송을 중단해 주세요." },
};

const CONTENT_TYPES = new Set(["emailsSent", "emailsReplied", "linkedinSent", "linkedinReplied"]);

// ── Public API ───────────────────────────────────────────────────────────────

function formatKoreanDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
}

/** Post parent Slack message when a lead is launched. Returns thread ts or null. */
export async function postLeadLaunch({
  channelId,
  leadName,
  company,
  role,
  country,
  linkedinUrl,
  assignee,
  campaignName,
  assignedAt,
  campaignLeadId,
  campaignId,
}: {
  channelId: string;
  leadName: string;
  company?: string | null;
  role?: string | null;
  country?: string | null;
  linkedinUrl?: string | null;
  assignee?: string | null;
  campaignName?: string | null;
  assignedAt?: Date | string | null;
  campaignLeadId?: string | null;
  campaignId?: string | null;
}): Promise<string | null> {
  if (!isConfigured()) {
    console.warn("[slack] SLACK_BOT_TOKEN or SLACK_CHANNEL_ID not set");
    return null;
  }

  const dateStr = formatKoreanDate(assignedAt);
  const metaParts: string[] = [];
  if (campaignName) metaParts.push(`*캠페인:* ${campaignName}`);
  if (assignee) metaParts.push(`*담당:* ${assignee}`);

  const headerText =
    `*📤 신규 리드가 시퀀스에 추가되었습니다.*` +
    (metaParts.length ? "\n" + metaParts.join("   ") : "");

  const identityParts = [`🚀 *${leadName}*`];
  const subParts: string[] = [];
  if (company) subParts.push(company);
  if (role) subParts.push(role);
  if (country) subParts.push(country);
  if (subParts.length) identityParts.push(subParts.join(" · "));

  const linkParts: string[] = [];
  if (linkedinUrl) linkParts.push(`<${linkedinUrl}|LinkedIn 프로필>`);
  const appUrl = process.env.APP_URL;
  if (appUrl && campaignLeadId && campaignId) {
    linkParts.push(`<${appUrl}/leads/${campaignLeadId}?from=campaign-analysis&campaignId=${campaignId}|리드 상세 페이지>`);
  }
  if (linkParts.length) identityParts.push(linkParts.join("  ·  "));

  const blocks: unknown[] = [
    { type: "section", text: { type: "mrkdwn", text: headerText } },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: identityParts.join("\n") } },
    { type: "divider" },
  ];
  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: `활동 업데이트는 스레드에서 확인하세요.${dateStr ? `\n시퀀스 추가일: ${dateStr}` : ""}` },
  });

  try {
    const data = await slackPost("chat.postMessage", {
      channel: channelId,
      blocks,
      text: `📤 ${leadName} 시퀀스 추가됨`,
      unfurl_links: false,
    });
    return (data.ts as string) ?? null;
  } catch (e) {
    console.error("[slack] postLeadLaunch error:", e);
    return null;
  }
}

/** Post all historical activities as ONE batched thread reply. */
export async function postActivitiesBatch(
  threadTs: string,
  channelId: string,
  activities: Array<{
    type: string;
    occurredAt: Date | string;
    content?: string | null;
    sequenceStep?: number | null;
    totalSequenceSteps?: number | null;
  }>
): Promise<void> {
  if (!isConfigured()) return;

  const visible = activities.filter((a) => !SKIP_TYPES.has(a.type));
  if (visible.length === 0) return;

  const lines = ["*활동 히스토리*", ""];
  for (const a of visible) {
    const info = ACTIVITY_INFO[a.type];
    const label = info?.label ?? `알 수 없는 활동 (${a.type})`;
    const prefix = info?.needsAttention ? "⚠️ " : "";
    lines.push(`${prefix}*${label}* — ${formatKST(a.occurredAt)}`);
    if (info?.note) lines.push(`_${info.note}_`);
    if (a.content && CONTENT_TYPES.has(a.type)) {
      const plain = htmlToPlain(a.content);
      lines.push("", `> ${plain}`, "");
    }
  }

  try {
    await slackPost("chat.postMessage", {
      channel: channelId,
      thread_ts: threadTs,
      blocks: [{ type: "section", text: { type: "mrkdwn", text: lines.join("\n") } }],
      text: `활동 히스토리 (${visible.length}건)`,
    });
  } catch (e) {
    console.error("[slack] postActivitiesBatch error:", e);
  }
}

/** Post a single activity as a Slack thread reply. No-op for skip types. */
export async function postActivityToThread(
  threadTs: string,
  channelId: string,
  activity: {
    type: string;
    occurredAt: Date | string;
    content?: string | null;
    sequenceStep?: number | null;
    totalSequenceSteps?: number | null;
  }
): Promise<void> {
  if (!isConfigured() || SKIP_TYPES.has(activity.type)) return;

  const info = ACTIVITY_INFO[activity.type];
  const label = info?.label ?? `알 수 없는 활동 (${activity.type})`;
  const prefix = info?.needsAttention ? "⚠️ " : "";
  const dateStr = formatKST(activity.occurredAt);

  const lines = [`${prefix}*${label}* — ${dateStr}`];
  if (info?.note) lines.push(`_${info.note}_`);
  if (activity.content && CONTENT_TYPES.has(activity.type)) {
    const plain = htmlToPlain(activity.content);
    lines.push("", `> ${plain}`);
  }

  try {
    await slackPost("chat.postMessage", {
      channel: channelId,
      thread_ts: threadTs,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
      ],
      text: `${prefix}${label} — ${dateStr}`,
    });
  } catch (e) {
    console.error("[slack] postActivityToThread error:", e);
  }
}
