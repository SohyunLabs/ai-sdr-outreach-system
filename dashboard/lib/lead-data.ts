import { prisma } from "@/lib/prisma";

export async function getLeadProfile(id: string) {
  return prisma.campaignLead.findUnique({
    where: { id },
    include: {
      contact: {
        include: { messages: true },
      },
      campaign: true,
      activities: {
        orderBy: { occurredAt: "desc" },
      },
    },
  });
}

export async function getLastSync(): Promise<Date | null> {
  const log = await prisma.syncLog.findFirst({
    orderBy: { syncedAt: "desc" },
  });
  return log?.syncedAt ?? null;
}

export type LeadProfileData = NonNullable<Awaited<ReturnType<typeof getLeadProfile>>>;

export async function getContactProfile(airtableId: string) {
  return prisma.contact.findUnique({
    where: { airtableId },
    include: {
      messages: true,
      leads: {
        where: { removedFromLemlist: false },
        include: {
          campaign: true,
          activities: { orderBy: { occurredAt: "desc" } },
        },
        orderBy: { syncedAt: "desc" },
      },
    },
  });
}

export type ContactProfileData = NonNullable<
  Awaited<ReturnType<typeof getContactProfile>>
>;

export async function getPendingLeadProfile(
  airtableId: string,
  campaignId: string
): Promise<LeadProfileData | null> {
  const [contact, campaign] = await Promise.all([
    prisma.contact.findUnique({
      where: { airtableId },
      include: { messages: { where: { campaignId } } },
    }),
    prisma.campaign.findUnique({ where: { id: campaignId } }),
  ]);

  if (!contact || !campaign) return null;

  return {
    id: contact.airtableId,
    lemlistLeadId: "",
    campaignId,
    airtableContactId: contact.airtableId,
    state: "tolaunch",
    sequenceStep: null,
    totalSequenceSteps: null,
    isLemlistDirty: false,
    assignedAt: null,
    syncedAt: new Date(),
    campaign,
    contact,
    activities: [],
  } as unknown as LeadProfileData;
}
