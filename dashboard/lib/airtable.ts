export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface ContactData {
  airtableId: string;
  name: string | null;
  company: string | null;
  role: string | null;
  aiScore: number | null;
  aiScoringReason: string | null;
  aiRecentInteractionsSummary: string | null;
  email: string | null;
  linkedinUrl: string | null;
  country: string | null;
  follower: number | null;
  connection: number | null;
  about: string | null;
  experiences: string | null;
}

const AIRTABLE_BASE = "https://api.airtable.com/v0";
export const CONTACT_TABLE_ID = process.env.AIRTABLE_CONTACT_TABLE_ID!;

export async function fetchAirtableRecord(
  tableId: string,
  recordId: string
): Promise<AirtableRecord> {
  const url = `${AIRTABLE_BASE}/${process.env.AIRTABLE_BASE_ID}/${tableId}/${recordId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable ${res.status}: ${body}`);
  }
  return res.json();
}

export async function fetchAllAirtableRecords(
  tableId: string
): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined = undefined;

  do {
    const url = new URL(
      `${AIRTABLE_BASE}/${process.env.AIRTABLE_BASE_ID}/${tableId}`
    );
    if (offset) {
      url.searchParams.set("offset", offset);
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
      },
      cache: "no-store",
    });

    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 30_000));
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable ${res.status}: ${body}`);
    }

    const data = (await res.json()) as {
      records: AirtableRecord[];
      offset?: string;
    };

    allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

export function transformContact(record: AirtableRecord): ContactData {
  const followerRaw = record.fields["Follower"];
  const connectionRaw = record.fields["Connection"];
  return {
    airtableId: record.id,
    name: (record.fields["Contact_Name"] as string) ?? null,
    company: (record.fields["Current_Company"] as string) ?? null,
    role: (record.fields["Contact Profile"] as string) ?? null,
    aiScore: (record.fields["AI Score (Profile)"] as number) ?? null,
    aiScoringReason: (record.fields["AI Scoring Reason (Profile)"] as string) ?? null,
    aiRecentInteractionsSummary: (record.fields["AI Recent_Interactions_summary (Profile)"] as string) ?? null,
    email: (record.fields["Email"] as string) ?? null,
    linkedinUrl: (record.fields["Profile_Url"] as string) ?? null,
    country: (record.fields["Country"] as string) ?? null,
    follower: followerRaw != null ? Number(followerRaw) : null,
    connection: connectionRaw != null ? Number(connectionRaw) : null,
    about: (record.fields["About"] as string) ?? null,
    experiences: (record.fields["Experiences"] as string) ?? null,
  };
}

