import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;

  // contacts that have a message for this campaign but no campaign_lead record
  const contacts = await prisma.contact.findMany({
    where: {
      messages: { some: { campaignId } },
      leads: { none: { campaignId } },
    },
    include: {
      messages: {
        where: { campaignId },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  // Shape as CampaignLeadWithContact for LeadTable compatibility
  const pending = contacts.map((c) => ({
    id: c.airtableId,
    lemlistLeadId: "",
    campaignId,
    airtableContactId: c.airtableId,
    state: "tolaunch",
    sequenceStep: null,
    totalSequenceSteps: null,
    sequenceType: c.messages[0]?.sequenceType ?? "linkedin",
    activities: [],
    contact: {
      airtableId: c.airtableId,
      name: c.name,
      company: c.company,
      role: c.role,
      aiScore: c.aiScore,
      email: c.email,
    },
  }));

  return NextResponse.json(pending);
}
