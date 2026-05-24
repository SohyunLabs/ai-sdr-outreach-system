import { prisma } from "@/lib/prisma";
import type { CampaignWithLeads, ContactWithLeads } from "@/lib/dashboard-utils";

// Re-export shared types and pure functions from dashboard-utils
// so existing imports from "@/lib/dashboard-data" continue to work
export type { CampaignLeadWithContact, CampaignWithLeads, CampaignSummary, UnmatchedLead } from "@/lib/dashboard-utils";
export { computeSummary, formatSyncTimestamp } from "@/lib/dashboard-utils";

export async function getDashboardData(): Promise<{
  campaigns: CampaignWithLeads[];
  lastSyncAt: Date | null;
}> {
  const [campaigns, lastSync] = await Promise.all([
    prisma.campaign.findMany({
      where: { archived: false },
      include: {
        leads: {
          where: { removedFromLemlist: false },
          include: {
            contact: true,
            activities: { select: { id: true, type: true, occurredAt: true, sequenceStep: true, totalSequenceSteps: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.syncLog.findFirst({
      orderBy: { syncedAt: "desc" },
    }),
  ]);

  const campaignsWithStatus = campaigns.map((c) => ({
    ...c,
    leads: c.leads.map((l) => ({ ...l, campaignStatus: c.status })),
  }));

  return {
    campaigns: campaignsWithStatus as unknown as CampaignWithLeads[],
    lastSyncAt: lastSync?.syncedAt ?? null,
  };
}

export async function getProfileAnalysisData(): Promise<{
  contacts: ContactWithLeads[];
  unmatchedLeads: import("@/lib/dashboard-utils").UnmatchedLead[];
  lastSyncAt: Date | null;
}> {
  const [rawContacts, rawUnmatched, lastSync] = await Promise.all([
    prisma.contact.findMany({
      include: {
        leads: {
          where: { removedFromLemlist: false },
          include: { campaign: true },
          orderBy: { syncedAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.campaignLead.findMany({
      where: { airtableContactId: null, removedFromLemlist: false },
      include: { campaign: true },
    }),
    prisma.syncLog.findFirst({ orderBy: { syncedAt: "desc" } }),
  ]);

  const contacts: ContactWithLeads[] = rawContacts.map((c) => ({
    airtableId: c.airtableId,
    name: c.name,
    company: c.company,
    role: c.role,
    aiScore: c.aiScore,
    email: c.email,
    leads: c.leads.map((l) => ({
      id: l.id,
      campaignId: l.campaignId,
      campaignName: l.campaign.name,
      state: l.state,
      sequenceStep: l.sequenceStep,
      totalSequenceSteps: l.totalSequenceSteps,
    })),
  }));

  const unmatchedLeads = rawUnmatched.map((l) => ({
    id: l.id,
    lemlistLeadId: l.lemlistLeadId,
    campaignId: l.campaignId,
    campaignName: l.campaign.name,
    state: l.state,
  }));

  return {
    contacts,
    unmatchedLeads,
    lastSyncAt: lastSync?.syncedAt ?? null,
  };
}
