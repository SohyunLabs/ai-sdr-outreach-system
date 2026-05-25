import { prisma } from "@/lib/prisma";
import { postLeadLaunch, postActivityToThread, postActivitiesBatch, resolveChannel } from "@/lib/slack";
import {
  fetchAllAirtableRecords,
  transformContact,
  CONTACT_TABLE_ID,
} from "@/lib/airtable";
import {
  fetchCampaigns,
  fetchCampaignLeadsExport,
  fetchLeadActivities,
  transformCampaign,
  transformLead,
  transformActivity,
} from "@/lib/lemlist";

export interface SyncResult {
  success: boolean;
  contactCount: number;
  campaignCount: number;
  leadCount: number;
  activityCount: number;
  joinFailureCount: number;
  errors: string[];
  durationMs: number;
}

async function syncAirtableContacts(): Promise<number> {
  const records = await fetchAllAirtableRecords(CONTACT_TABLE_ID);
  for (const record of records) {
    const data = transformContact(record);
    await prisma.contact.upsert({
      where: { airtableId: data.airtableId },
      update: {
        name: data.name,
        company: data.company,
        role: data.role,
        aiScore: data.aiScore,
        aiScoringReason: data.aiScoringReason,
        aiRecentInteractionsSummary: data.aiRecentInteractionsSummary,
        email: data.email,
        linkedinUrl: data.linkedinUrl,
        country: data.country,
        follower: data.follower,
        connection: data.connection,
        about: data.about,
        experiences: data.experiences,
        syncedAt: new Date(),
      },
      create: {
        airtableId: data.airtableId,
        name: data.name,
        company: data.company,
        role: data.role,
        aiScore: data.aiScore,
        aiScoringReason: data.aiScoringReason,
        aiRecentInteractionsSummary: data.aiRecentInteractionsSummary,
        email: data.email,
        linkedinUrl: data.linkedinUrl,
        country: data.country,
        follower: data.follower,
        connection: data.connection,
        about: data.about,
        experiences: data.experiences,
      },
    });
  }
  return records.length;
}


async function syncLemlistCampaignsAndLeads(): Promise<{
  campaignCount: number;
  leadCount: number;
}> {
  const campaigns = await fetchCampaigns();
  let leadCount = 0;

  const syncedCampaignIds: string[] = [];
  const syncedLeadIds: string[] = [];

  for (const campaign of campaigns) {
    const data = transformCampaign(campaign);
    syncedCampaignIds.push(data.id);
    await prisma.campaign.upsert({
      where: { id: data.id },
      update: { name: data.name, status: data.status, archived: data.archived, syncedAt: new Date() },
      create: { id: data.id, name: data.name, status: data.status, archived: data.archived },
    });

    const leads = await fetchCampaignLeadsExport(campaign._id);
    for (const lead of leads) {
      const leadData = transformLead(lead, campaign._id);
      syncedLeadIds.push(leadData.lemlistLeadId);
      await prisma.campaignLead.upsert({
        where: { lemlistLeadId: leadData.lemlistLeadId },
        update: {
          campaignId: leadData.campaignId,
          // Only update airtableContactId when non-null (preserve existing link)
          ...(leadData.airtableContactId !== null && { airtableContactId: leadData.airtableContactId }),
          state: leadData.state,
          lemlistStatus: leadData.lemlistStatus,
          sequenceStep: leadData.sequenceStep,
          totalSequenceSteps: leadData.totalSequenceSteps,
          // Preserve assignedAt recorded at launch time (don't overwrite with null)
          ...(leadData.assignedAt !== null && { assignedAt: leadData.assignedAt }),
          syncedAt: new Date(),
        },
        create: {
          lemlistLeadId: leadData.lemlistLeadId,
          campaignId: leadData.campaignId,
          airtableContactId: leadData.airtableContactId,
          state: leadData.state,
          lemlistStatus: leadData.lemlistStatus,
          sequenceStep: leadData.sequenceStep,
          totalSequenceSteps: leadData.totalSequenceSteps,
          assignedAt: leadData.assignedAt,
        },
      });
      leadCount++;
    }
  }

  // Clean up leads from deleted campaigns (campaign removed from Lemlist)
  if (syncedCampaignIds.length > 0) {
    const deletedCampaignLeads = await prisma.campaignLead.findMany({
      where: { campaignId: { notIn: syncedCampaignIds } },
      select: { id: true },
    });
    if (deletedCampaignLeads.length > 0) {
      const ids = deletedCampaignLeads.map((l) => l.id);
      await prisma.activity.deleteMany({ where: { campaignLeadId: { in: ids } } });
      await prisma.campaignLead.deleteMany({ where: { id: { in: ids } } });
    }
  }

  // Only delete leads excluded from Lemlist export within synced campaigns
  // Scoped to syncedCampaignIds to prevent over-deletion on export failure
  const staleLeads = await prisma.campaignLead.findMany({
    where: {
      campaignId: { in: syncedCampaignIds },
      lemlistLeadId: { notIn: syncedLeadIds },
    },
    select: { id: true },
  });
  if (staleLeads.length > 0) {
    const staleLeadIds = staleLeads.map((l) => l.id);
    await prisma.activity.deleteMany({ where: { campaignLeadId: { in: staleLeadIds } } });
    await prisma.campaignLead.deleteMany({ where: { id: { in: staleLeadIds } } });
  }

  // Clean up campaigns deleted from Lemlist (leads already removed above, no FK constraint)
  if (syncedCampaignIds.length > 0) {
    await prisma.campaign.deleteMany({ where: { id: { notIn: syncedCampaignIds } } });
  }

  return { campaignCount: campaigns.length, leadCount };
}

async function syncLemlistActivities(): Promise<{ count: number; errors: string[] }> {
  const campaigns = await prisma.campaign.findMany({ select: { id: true } });

  // Collect leads from all campaigns at once
  const allLeads: { campaignId: string; dbId: string; lemlistLeadId: string }[] = [];
  for (const campaign of campaigns) {
    const leads = await prisma.campaignLead.findMany({
      where: { campaignId: campaign.id },
      select: { id: true, lemlistLeadId: true },
    });
    for (const l of leads) {
      allLeads.push({ campaignId: campaign.id, dbId: l.id, lemlistLeadId: l.lemlistLeadId });
    }
  }

  console.log(`[syncActivities] total leads to sync: ${allLeads.length}`);

  // Process 5 at a time in parallel
  const CONCURRENCY = 5;
  let totalActivityCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < allLeads.length; i += CONCURRENCY) {
    const batch = allLeads.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async ({ campaignId, dbId, lemlistLeadId }) => {
        // Fetch per lead — bulk fetch by campaign has leadId omission bug
        const leadActivities = await fetchLeadActivities(campaignId, lemlistLeadId);
        if (!leadActivities || leadActivities.length === 0) return 0;

        await prisma.activity.deleteMany({ where: { campaignLeadId: dbId } });

        const transformed = leadActivities.map((a) => {
          const t = transformActivity(a);
          return {
            campaignLeadId: dbId,
            type: t.type,
            occurredAt: t.occurredAt,
            sequenceStep: t.sequenceStep,
            totalSequenceSteps: t.totalSequenceSteps,
            content: t.content,
            sentOutside: t.sentOutside,
          };
        });

        await prisma.activity.createMany({ data: transformed });
        console.log(`[syncActivities] lead=${lemlistLeadId} created=${transformed.length}`);
        return transformed.length;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        totalActivityCount += result.value;
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(`[syncActivities] error: ${msg}`);
        errors.push(msg);
      }
    }
  }

  return { count: totalActivityCount, errors };
}

async function syncSlack(): Promise<void> {
  console.log("[syncSlack] starting");

  // Determine "new activity" based on previous sync time
  const prevSync = await prisma.syncLog.findFirst({ orderBy: { syncedAt: "desc" }, skip: 1 });
  const newCutoff = prevSync?.syncedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  console.log(`[syncSlack] newCutoff=${newCutoff.toISOString()}`);

  // Only target leads with new activities since last sync
  const leads = await prisma.campaignLead.findMany({
    where: {
      activities: { some: { occurredAt: { gt: newCutoff } } },
      airtableContactId: { not: null },
    },
    select: {
      id: true,
      campaignId: true,
      airtableContactId: true,
      assignedAt: true,
      slackThreadTs: true,
      slackChannelId: true,
      slackLastPostedAt: true,
      activities: { orderBy: { occurredAt: "asc" } },
      contact: { select: { name: true, company: true, role: true, assignee: true, country: true, linkedinUrl: true } },
      campaign: { select: { name: true } },
    },
  });

  console.log(`[syncSlack] leads with new activities: ${leads.length}`);

  for (const lead of leads) {
    try {
      const country = lead.contact?.country;
      const newActivities = lead.activities.filter((a) => a.occurredAt > newCutoff);

      if (!lead.slackThreadTs) {
        // No thread — create parent + batch historical activities + post new activities individually
        const channelId = resolveChannel(country);
        const ts = await postLeadLaunch({
          channelId,
          leadName: lead.contact?.name ?? lead.airtableContactId ?? "Unknown",
          company: lead.contact?.company,
          role: lead.contact?.role,
          country: lead.contact?.country,
          linkedinUrl: lead.contact?.linkedinUrl,
          assignee: lead.contact?.assignee,
          campaignName: lead.campaign?.name,
          assignedAt: lead.assignedAt ?? lead.activities[0]?.occurredAt ?? null,
          campaignLeadId: lead.id,
          campaignId: lead.campaignId,
        });
        if (!ts) continue;

        await prisma.campaignLead.update({
          where: { id: lead.id },
          data: { slackThreadTs: ts, slackChannelId: channelId },
        });

        // Historical activities — batch into one message
        const historical = lead.activities.filter((a) => a.occurredAt <= newCutoff);
        if (historical.length > 0) {
          await postActivitiesBatch(ts, channelId, historical);
        }

        // New activities — post individually
        for (const a of newActivities) {
          await postActivityToThread(ts, channelId, a);
        }

        await prisma.campaignLead.update({
          where: { id: lead.id },
          data: { slackLastPostedAt: new Date() },
        });
        console.log(`[syncSlack] new thread lead=${lead.id} history=${historical.length} new=${newActivities.length}`);
      } else {
        // Thread exists — post only new activities individually
        const channelId = lead.slackChannelId ?? resolveChannel(country);
        const cutoff = lead.slackLastPostedAt ?? newCutoff;
        const toPost = lead.activities.filter((a) => a.occurredAt > cutoff);

        for (const a of toPost) {
          await postActivityToThread(lead.slackThreadTs, channelId, a);
        }
        if (toPost.length > 0) {
          await prisma.campaignLead.update({
            where: { id: lead.id },
            data: { slackLastPostedAt: new Date() },
          });
          console.log(`[syncSlack] updated thread lead=${lead.id} new=${toPost.length}`);
        }
      }
    } catch (e) {
      console.error(`[syncSlack] error for lead=${lead.id}:`, e);
    }
  }
}

async function calculateAndFixJoinFailures(): Promise<number> {
  // Find orphaned FK values: airtableContactId is set but no matching Contact row exists
  const orphanedLeads = await prisma.campaignLead.findMany({
    where: {
      airtableContactId: { not: null },
      contact: null,
    },
    select: { id: true },
  });

  if (orphanedLeads.length > 0) {
    await prisma.campaignLead.updateMany({
      where: { id: { in: orphanedLeads.map((l) => l.id) } },
      data: { airtableContactId: null },
    });
  }

  // Count all unmatched leads (including those already null + newly nulled orphans)
  const unmatchedCount = await prisma.campaignLead.count({
    where: { airtableContactId: null },
  });

  return unmatchedCount;
}

export async function runFullSync(): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let contactCount = 0;
  let campaignCount = 0;
  let leadCount = 0;
  let activityCount = 0;

  // Step 1: Airtable contacts MUST complete before Lemlist (FK dependency)
  try {
    contactCount = await syncAirtableContacts();
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  // Step 2: Lemlist campaigns/leads
  try {
    const lemlistResult = await syncLemlistCampaignsAndLeads();
    campaignCount = lemlistResult.campaignCount;
    leadCount = lemlistResult.leadCount;
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  // Step 3: Activities depend on campaign_leads existing
  try {
    const activityResult = await syncLemlistActivities();
    activityCount = activityResult.count;
    errors.push(...activityResult.errors);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  // Step 4: Slack thread sync
  try {
    await syncSlack();
  } catch (e) {
    console.error("[syncSlack] fatal:", e);
  }

  // Step 5: Calculate join failures (orphan nulling + count)
  let joinFailureCount = 0;
  try {
    joinFailureCount = await calculateAndFixJoinFailures();
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  // Step 6: Write SyncLog
  await prisma.syncLog.create({
    data: {
      source:
        errors.length === 0
          ? "both"
          : contactCount > 0 && campaignCount === 0
            ? "airtable"
            : "partial",
      contactCount,
      messageCount: 0,
      campaignCount,
      leadCount,
      activityCount,
      joinFailureCount,
      errors: errors.length > 0 ? JSON.stringify(errors) : null,
    },
  });

  return {
    success: errors.length === 0,
    contactCount,
    campaignCount,
    leadCount,
    activityCount,
    joinFailureCount,
    errors,
    durationMs: Date.now() - startTime,
  };
}
