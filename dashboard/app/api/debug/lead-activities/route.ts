import { prisma } from "@/lib/prisma";
import { fetchLeadActivities } from "@/lib/lemlist";

/**
 * GET /api/debug/lead-activities?leadId=[CampaignLead.id]
 * Uses the same fetchLeadActivities as inbox to return all raw data.
 * For diagnosing actual activity type names and available fields.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");

  if (!leadId) {
    return Response.json({ error: "leadId param required" }, { status: 400 });
  }

  const lead = await prisma.campaignLead.findUnique({
    where: { id: leadId },
    include: {
      activities: { orderBy: { occurredAt: "asc" } },
      campaign: true,
    },
  });

  if (!lead) {
    return Response.json({ error: "Lead not found in DB" }, { status: 404 });
  }

  // Same fetchLeadActivities as inbox (with leadId filter)
  const apiActivities = await fetchLeadActivities(lead.campaignId, lead.lemlistLeadId);

  // Group by type and return raw samples for each type
  const byType: Record<string, unknown[]> = {};
  for (const a of apiActivities) {
    const t = (a as Record<string, unknown>).type as string ?? "unknown";
    if (!byType[t]) byType[t] = [];
    byType[t].push(a); // full raw data
  }

  return Response.json({
    db: {
      id: lead.id,
      lemlistLeadId: lead.lemlistLeadId,
      campaignId: lead.campaignId,
      campaignName: lead.campaign.name,
      activitiesInDb: lead.activities.length,
      activityTypesSynced: lead.activities.map((a) => ({ type: a.type, occurredAt: a.occurredAt, content: a.content })),
    },
    lemlistApi: {
      totalReturned: apiActivities.length,
      allTypes: Object.keys(byType),
      byType, // raw data grouped by type
    },
  });
}
