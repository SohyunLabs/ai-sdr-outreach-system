import { prisma } from "@/lib/prisma";
import { fetchLeadActivities } from "@/lib/lemlist";

/**
 * GET /api/debug/lead-activities?leadId=[CampaignLead.id]
 * inbox와 동일한 fetchLeadActivities를 사용해 raw 데이터를 전부 반환.
 * 실제 activity 타입명 및 어떤 필드가 있는지 진단용.
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

  // inbox와 동일한 fetchLeadActivities 사용 (leadId 필터 적용)
  const apiActivities = await fetchLeadActivities(lead.campaignId, lead.lemlistLeadId);

  // 타입별로 그룹핑해서 각 타입의 raw 샘플 반환
  const byType: Record<string, unknown[]> = {};
  for (const a of apiActivities) {
    const t = (a as Record<string, unknown>).type as string ?? "unknown";
    if (!byType[t]) byType[t] = [];
    byType[t].push(a); // raw 전체 데이터
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
      byType, // 타입별 raw 전체 데이터
    },
  });
}
