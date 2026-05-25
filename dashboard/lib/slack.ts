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

function formatTimestamp(date: Date | string): string {
  return new Date(date).toLocaleString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SKIP_TYPES = new Set(["conditionChosen", "campaignStepStarted", "skipped", "paused", "resumed"]);

const ACTIVITY_INFO: Record<string, { label: string; needsAttention?: boolean; note?: string }> = {
  emailsSent:             { label: "Email Sent" },
  emailsOpened:           { label: "Email Opened" },
  emailsReplied:          { label: "Email Reply Received" },
  emailsBounced:          { label: "Email Bounced", needsAttention: true, note: "Email bounced. Verify the email address or switch to another channel." },
  linkedinConnect:        { label: "LinkedIn Invite Sent" },
  linkedinInviteDone:     { label: "LinkedIn Invite Sent" },
  linkedinInviteAccepted: { label: "LinkedIn Invite Accepted" },
  linkedinSent:           { label: "LinkedIn Message Sent" },
  linkedinReplied:        { label: "LinkedIn Reply Received" },
  linkedinVisit:          { label: "LinkedIn Profile Visit" },
  linkedinOpened:         { label: "LinkedIn Message Opened" },
  linkedinSendFailed:     { label: "LinkedIn Send Failed", needsAttention: true, note: "LinkedIn message send failed. Check connection status and account limits." },
  apiUnsubscribed:        { label: "Unsubscribed", needsAttention: true, note: "Lead has unsubscribed. Stop all follow-up messages immediately." },
};

const CONTENT_TYPES = new Set(["emailsSent", "emailsReplied", "linkedinSent", "linkedinReplied"]);

// ── Public API ───────────────────────────────────────────────────────────────

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
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

  const dateStr = formatDate(assignedAt);
  const metaParts: string[] = [];
  if (campaignName) metaParts.push(`*Campaign:* ${campaignName}`);
  if (assignee) metaParts.push(`*Assignee:* ${assignee}`);

  const headerText =
    `*New lead added to sequence.*` +
    (metaParts.length ? "\n" + metaParts.join("   ") : "");

  const identityParts = [`*${leadName}*`];
  const subParts: string[] = [];
  if (company) subParts.push(company);
  if (role) subParts.push(role);
  if (country) subParts.push(country);
  if (subParts.length) identityParts.push(subParts.join(" · "));

  const linkParts: string[] = [];
  if (linkedinUrl) linkParts.push(`<${linkedinUrl}|LinkedIn Profile>`);
  const appUrl = process.env.APP_URL;
  if (appUrl && campaignLeadId && campaignId) {
    linkParts.push(`<${appUrl}/leads/${campaignLeadId}?from=campaign-analysis&campaignId=${campaignId}|Lead Detail Page>`);
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
    text: { type: "mrkdwn", text: `Activity updates will appear in this thread.${dateStr ? `\nAdded to sequence: ${dateStr}` : ""}` },
  });

  try {
    const data = await slackPost("chat.postMessage", {
      channel: channelId,
      blocks,
      text: `${leadName} added to sequence`,
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

  const lines = ["*Activity History*", ""];
  for (const a of visible) {
    const info = ACTIVITY_INFO[a.type];
    const label = info?.label ?? `Unknown activity (${a.type})`;
    const prefix = info?.needsAttention ? "Warning: " : "";
    lines.push(`${prefix}*${label}* -- ${formatTimestamp(a.occurredAt)}`);
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
      text: `Activity history (${visible.length} events)`,
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
  const label = info?.label ?? `Unknown activity (${activity.type})`;
  const prefix = info?.needsAttention ? "Warning: " : "";
  const dateStr = formatTimestamp(activity.occurredAt);

  const lines = [`${prefix}*${label}* -- ${dateStr}`];
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
      text: `${prefix}${label} -- ${dateStr}`,
    });
  } catch (e) {
    console.error("[slack] postActivityToThread error:", e);
  }
}
