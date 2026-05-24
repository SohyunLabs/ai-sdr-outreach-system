import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock modules before importing runFullSync
vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    message: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    campaign: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    campaignLead: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    activity: {
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    },
    syncLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/airtable", () => ({
  CONTACT_TABLE_ID: "tblContacts",
  fetchAllAirtableRecords: vi.fn().mockResolvedValue([]),
  transformContact: vi.fn().mockReturnValue({
    airtableId: "rec1",
    name: "Alice",
    company: "Acme",
    role: "CTO",
    aiScore: 90,
    email: "a@b.com",
    linkedinUrl: null,
  }),
}));

vi.mock("@/lib/lemlist", () => ({
  fetchCampaigns: vi.fn().mockResolvedValue([]),
  fetchCampaignLeadsExport: vi.fn().mockResolvedValue([]),
  fetchAllActivities: vi.fn().mockResolvedValue([]),
  transformCampaign: vi.fn().mockReturnValue({ id: "camp1", name: "Q2" }),
  transformLead: vi.fn().mockReturnValue({
    lemlistLeadId: "lead1",
    campaignId: "camp1",
    airtableContactId: null,
    state: null,
    sequenceStep: null,
    totalSequenceSteps: null,
    assignedAt: null,
  }),
  transformActivity: vi.fn().mockReturnValue({
    type: "emailsSent",
    occurredAt: new Date("2026-01-15T10:00:00Z"),
    sequenceStep: null,
    totalSequenceSteps: null,
  }),
}));

import { runFullSync } from "../lib/sync";
import { prisma } from "@/lib/prisma";
import {
  fetchAllAirtableRecords,
  CONTACT_TABLE_ID,
} from "@/lib/airtable";
import { fetchCampaigns, fetchCampaignLeadsExport } from "@/lib/lemlist";

describe("runFullSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: all mocks return empty data (no errors)
    vi.mocked(fetchAllAirtableRecords).mockResolvedValue([]);
    vi.mocked(fetchCampaigns).mockResolvedValue([]);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);
    vi.mocked(prisma.syncLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.campaignLead.findMany).mockResolvedValue([]);
    vi.mocked(prisma.campaignLead.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.campaignLead.count).mockResolvedValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls syncAirtableContacts (fetchAllAirtableRecords with CONTACT_TABLE_ID) before fetchCampaigns", async () => {
    const callOrder: string[] = [];

    vi.mocked(fetchAllAirtableRecords).mockImplementation(async (tableId) => {
      if (tableId === CONTACT_TABLE_ID) {
        callOrder.push("contacts");
      }
      return [];
    });

    vi.mocked(fetchCampaigns).mockImplementation(async () => {
      callOrder.push("lemlist");
      return [];
    });

    await runFullSync();

    // contacts must appear before lemlist
    expect(callOrder.indexOf("contacts")).toBeLessThan(
      callOrder.indexOf("lemlist")
    );
  });

  it("partial failure: airtable contacts succeed, lemlist fails — result has success=false, contactCount>0, errors array", async () => {
    // Return 2 contact records
    vi.mocked(fetchAllAirtableRecords).mockResolvedValue([
      { id: "rec1", createdTime: "2026-01-01T00:00:00Z", fields: { Name: "Alice" } },
      { id: "rec2", createdTime: "2026-01-01T00:00:00Z", fields: { Name: "Bob" } },
    ]);

    // Lemlist throws
    vi.mocked(fetchCampaigns).mockRejectedValue(
      new Error("Lemlist campaigns 401")
    );

    const result = await runFullSync();

    expect(result.success).toBe(false);
    expect(result.contactCount).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Lemlist campaigns 401");
  });

  it("writes SyncLog with correct counts after fully successful sync", async () => {
    // 3 contact records, 1 campaign with 2 leads
    vi.mocked(fetchAllAirtableRecords).mockResolvedValue([
      { id: "rec1", createdTime: "2026-01-01T00:00:00Z", fields: {} },
      { id: "rec2", createdTime: "2026-01-01T00:00:00Z", fields: {} },
      { id: "rec3", createdTime: "2026-01-01T00:00:00Z", fields: {} },
    ]);

    vi.mocked(fetchCampaigns).mockResolvedValue([
      { _id: "camp1", name: "Q2 Outreach" },
    ]);

    vi.mocked(fetchCampaignLeadsExport).mockResolvedValue([
      { _id: "lead1", lastState: "emailsSent" },
      { _id: "lead2", lastState: "emailsSent" },
    ]);

    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      { id: "camp1" } as never,
    ]);
    vi.mocked(prisma.campaignLead.findMany).mockResolvedValue([]);
    vi.mocked(prisma.campaignLead.count).mockResolvedValue(0);

    const result = await runFullSync();

    expect(result.success).toBe(true);
    expect(result.contactCount).toBe(3);
    expect(result.campaignCount).toBe(1);
    expect(result.leadCount).toBe(2);
    expect(result.errors).toHaveLength(0);

    expect(prisma.syncLog.create).toHaveBeenCalledOnce();
    const syncLogCall = vi.mocked(prisma.syncLog.create).mock.calls[0][0];
    expect(syncLogCall.data.contactCount).toBe(3);
    expect(syncLogCall.data.campaignCount).toBe(1);
    expect(syncLogCall.data.leadCount).toBe(2);
    expect(syncLogCall.data.source).toBe("both");
    expect(syncLogCall.data.errors).toBeNull();
    expect(typeof syncLogCall.data.joinFailureCount).toBe("number");
  });

  it("SyncLog errors field contains JSON string when errors occur", async () => {
    vi.mocked(fetchCampaigns).mockRejectedValue(new Error("rate limited"));
    vi.mocked(fetchAllAirtableRecords).mockResolvedValue([]);

    await runFullSync();

    const syncLogCall = vi.mocked(prisma.syncLog.create).mock.calls[0][0];
    expect(syncLogCall.data.errors).toBe(JSON.stringify(["rate limited"]));
  });

  it("writes joinFailureCount to SyncLog", async () => {
    vi.mocked(fetchCampaignLeadsExport).mockResolvedValue([
      { _id: "lead1", lastState: "emailsSent" },
    ]);
    vi.mocked(fetchCampaigns).mockResolvedValue([
      { _id: "camp1", name: "Q2" },
    ]);
    // After upsert, findMany for orphans returns empty (no orphans)
    vi.mocked(prisma.campaignLead.findMany).mockResolvedValue([]);
    // Count of unmatched leads
    vi.mocked(prisma.campaignLead.count).mockResolvedValue(5);

    const result = await runFullSync();

    expect(result.joinFailureCount).toBe(5);
    const syncLogData = vi.mocked(prisma.syncLog.create).mock.calls[0][0].data;
    expect(syncLogData.joinFailureCount).toBe(5);
  });

  it("nulls orphaned airtableContactId when Contact row missing", async () => {
    vi.mocked(fetchCampaignLeadsExport).mockResolvedValue([
      { _id: "lead1", airtableContactId: "recOrphan", lastState: "emailsSent" },
    ]);
    vi.mocked(fetchCampaigns).mockResolvedValue([
      { _id: "camp1", name: "Q2" },
    ]);
    // campaign.findMany for activities returns a campaign with one lead
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      { id: "camp1" } as never,
    ]);
    // campaignLead.findMany: first call = activities lookup (returns one lead), second = orphan detection (returns orphan)
    vi.mocked(prisma.campaignLead.findMany)
      .mockResolvedValueOnce([{ id: "clead1", lemlistLeadId: "lead1" }] as any) // activities lookup
      .mockResolvedValueOnce([{ id: "clead1" }] as any);                         // orphan detection
    vi.mocked(prisma.campaignLead.count).mockResolvedValue(1);

    await runFullSync();

    expect(prisma.campaignLead.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["clead1"] } },
      data: { airtableContactId: null },
    });
  });

  it("SyncResult includes joinFailureCount field", async () => {
    vi.mocked(fetchAllAirtableRecords).mockResolvedValue([]);
    vi.mocked(fetchCampaigns).mockResolvedValue([]);
    vi.mocked(prisma.campaignLead.count).mockResolvedValue(0);

    const result = await runFullSync();

    expect(result).toHaveProperty("joinFailureCount");
    expect(typeof result.joinFailureCount).toBe("number");
  });
});
