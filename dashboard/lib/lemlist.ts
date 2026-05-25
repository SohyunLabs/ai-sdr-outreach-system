import Papa from "papaparse";

export interface LemlistCampaign {
  _id: string;
  name: string;
  [key: string]: unknown;
}

export interface LemlistActivity {
  _id: string;
  type: string;
  createdAt: string;
  sequenceStep?: number;
  /** API field name is singular: totalSequenceStep */
  totalSequenceStep?: number;
  campaignId?: string;
  leadId?: string;
  [key: string]: unknown;
}

export interface CampaignData {
  id: string;
  name: string;
  status: string | null;
  archived: boolean;
}

export interface CampaignLeadData {
  lemlistLeadId: string;
  campaignId: string;
  airtableContactId: string | null;
  state: string | null;
  lemlistStatus: string | null;
  sequenceStep: number | null;
  totalSequenceSteps: number | null;
  assignedAt: Date | null;
}

export interface ActivityData {
  type: string;
  occurredAt: Date;
  sequenceStep: number | null;
  totalSequenceSteps: number | null;
  content: string | null;
  sentOutside: boolean;
}

/**
 * Lemlist Basic auth uses empty username + API key as password.
 * The colon prefix (`:key`) is critical — it encodes as `:<key>` in base64.
 */
function lemlistHeaders(): HeadersInit {
  const encoded = Buffer.from(`:${process.env.LEMLIST_API_KEY}`).toString("base64");
  return {
    Authorization: `Basic ${encoded}`,
    "Content-Type": "application/json",
  };
}

export async function fetchCampaigns(): Promise<LemlistCampaign[]> {
  const res = await fetch("https://api.lemlist.com/api/campaigns", {
    headers: lemlistHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Lemlist campaigns ${res.status}`);
  }
  return res.json();
}

export async function fetchCampaignLeadsExport(
  campaignId: string
): Promise<Record<string, string>[]> {
  const res = await fetch(
    `https://api.lemlist.com/api/campaigns/${campaignId}/export/leads?state=all&format=csv`,
    { headers: lemlistHeaders(), cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Lemlist export leads ${res.status}`);
  }
  const csvText = await res.text();
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.meta.fields && !parsed.meta.fields.includes("airtableContactId")) {
    console.warn(
      `[lemlist] airtableContactId column absent from campaign ${campaignId} export — all leads will be unmatched`
    );
  }
  return parsed.data;
}

/** Fetch activities for a specific lead in a campaign (for inbox view) */
export async function fetchLeadActivities(campaignId: string, leadId: string): Promise<LemlistActivity[]> {
  const res = await fetch(
    `https://api.lemlist.com/api/activities?campaignId=${campaignId}&leadId=${leadId}&limit=100`,
    { headers: lemlistHeaders(), cache: "no-store" }
  );
  console.log(`[fetchLeadActivities] status=${res.status} leadId=${leadId}`);
  if (!res.ok) { console.log("[fetchLeadActivities] not ok, returning []"); return []; }
  const data = await res.json();
  console.log(`[fetchLeadActivities] parsed count=${Array.isArray(data) ? data.length : "NOT_ARRAY"}`);
  return data;
}

export async function fetchAllActivities(campaignId: string): Promise<LemlistActivity[]> {
  const all: LemlistActivity[] = [];
  let offset = 0;

  while (true) {
    const res = await fetch(
      `https://api.lemlist.com/api/activities?campaignId=${campaignId}&limit=100&offset=${offset}`,
      {
        headers: lemlistHeaders(),
        cache: "no-store",
      }
    );
    if (!res.ok) {
      throw new Error(`Lemlist activities ${res.status}`);
    }
    const page: LemlistActivity[] = await res.json();
    if (page.length === 0) break;
    all.push(...page);
    offset += page.length;
    await new Promise((r) => setTimeout(r, 100));
  }

  return all;
}

export function transformCampaign(campaign: LemlistCampaign): CampaignData {
  return {
    id: campaign._id,
    name: campaign.name,
    status: (campaign.status as string) ?? null,
    archived: (campaign.archived as boolean) ?? false,
  };
}

export function transformLead(
  lead: Record<string, string | undefined>,
  campaignId: string
): CampaignLeadData {
  const sentStepRaw = lead.sentStep;
  const sentStep =
    sentStepRaw != null && sentStepRaw !== "" ? parseInt(sentStepRaw, 10) : NaN;
  return {
    lemlistLeadId: lead._id ?? "",
    campaignId,
    airtableContactId: lead.airtableContactId ?? null,
    state: lead.lastState ?? null,
    lemlistStatus: lead.status ?? null,
    sequenceStep: Number.isNaN(sentStep) ? null : sentStep,
    totalSequenceSteps: null,
    assignedAt: null,
  };
}

/**
 * Lemlist REST API does not support GET /api/leads/{id}.
 * Instead, find by _id (lea_XXXX) in campaign CSV export.
 */
export async function fetchLeadFromCampaign(
  campaignId: string,
  lemlistLeadId: string
): Promise<Record<string, string>> {
  const leads = await fetchCampaignLeadsExport(campaignId);
  const lead = leads.find((l) => l._id === lemlistLeadId);
  if (!lead) {
    throw new Error(`Lemlist lead not found in campaign export (id: ${lemlistLeadId})`);
  }
  return lead;
}

/**
 * PATCH /api/campaigns/{campaignId}/leads/{leadId} — update basic info
 * Supported fields: firstName, lastName, companyName, jobTitle
 */
export async function updateLeadInfo(
  campaignId: string,
  leadId: string,
  data: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    jobTitle?: string;
  }
): Promise<void> {
  const res = await fetch(
    `https://api.lemlist.com/api/campaigns/${campaignId}/leads/${encodeURIComponent(leadId)}`,
    {
      method: "PATCH",
      headers: lemlistHeaders(),
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lemlist lead info update failed (${res.status}): ${text}`);
  }
}

/**
 * PATCH /api/leads/{leadId}/variables — update custom variables
 * Lemlist API requires URL-encoded form data, not JSON
 */
export async function updateLeadVariables(
  leadId: string,
  variables: Record<string, string>
): Promise<void> {
  const body = new URLSearchParams(variables).toString();
  const encoded = Buffer.from(`:${process.env.LEMLIST_API_KEY}`).toString("base64");
  const res = await fetch(
    `https://api.lemlist.com/api/leads/${encodeURIComponent(leadId)}/variables`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Basic ${encoded}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lemlist variables update failed (${res.status}): ${text}`);
  }
}

/**
 * POST /api/leads/start/{leadId} — resume a paused lead
 * If campaignId is specified, resume only in that campaign
 * If response isPaused is still true, the lead was not actually started
 */
export async function resumeLead(leadId: string, campaignId?: string): Promise<{ isPaused: boolean }> {
  const url = new URL(
    `https://api.lemlist.com/api/leads/start/${encodeURIComponent(leadId)}`
  );
  if (campaignId) url.searchParams.set("campaignId", campaignId);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: lemlistHeaders(),
  });
  const rawText = await res.text();
  console.log(`[resumeLead] status=${res.status} leadId=${leadId} campaignId=${campaignId}`);
  console.log(`[resumeLead] response body:`, rawText);
  if (!res.ok) {
    throw new Error(`Lemlist resume lead failed (${res.status}): ${rawText}`);
  }
  let data: unknown;
  try { data = JSON.parse(rawText); } catch { data = rawText; }
  const lead = Array.isArray(data) ? data[0] : data;
  const isPaused = (lead as Record<string, unknown>)?.isPaused ?? false;
  console.log(`[resumeLead] isPaused=${isPaused}`);
  return { isPaused: isPaused as boolean };
}

/** State update — best-effort due to Lemlist API limitations */
export async function updateLeadState(
  _campaignId: string,
  _leadId: string,
  _state: string
): Promise<void> {
  // Lemlist has no general API to set state directly (only dedicated endpoints for interested/notInterested etc.)
  // Currently a no-op
}

export function transformActivity(activity: LemlistActivity): ActivityData {
  const type = activity.type;
  const isLinkedinInvite = type === "linkedinConnect" || type === "linkedinInviteDone";

  // m4LIConnReqBody is a lead variable that Lemlist echoes on every activity.
  // Only use it for LinkedIn invite types; for everything else it would show the wrong content.
  const content = isLinkedinInvite
    ? (activity.m4LIConnReqBody as string | null | undefined) ??
      (activity.text as string | null | undefined) ??
      (activity.message as string | null | undefined) ??
      (activity.value as string | null | undefined) ??
      null
    : (activity.body as string | null | undefined) ??
      (activity.text as string | null | undefined) ??
      (activity.message as string | null | undefined) ??
      (activity.messagePreview as string | null | undefined) ??
      (activity.value as string | null | undefined) ??
      null;

  return {
    type,
    occurredAt: new Date(activity.createdAt),
    sequenceStep: activity.sequenceStep ?? null,
    totalSequenceSteps: activity.totalSequenceStep ?? null,
    content,
    sentOutside: (activity.sentOutSideOfLemlist as boolean | undefined) ?? false,
  };
}
