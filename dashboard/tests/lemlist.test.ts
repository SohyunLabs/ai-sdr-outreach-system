import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  transformCampaign,
  transformLead,
  transformActivity,
  fetchAllActivities,
  fetchCampaignLeadsExport,
} from "../lib/lemlist";

describe("transformCampaign", () => {
  it("maps _id to id and preserves name", () => {
    const result = transformCampaign({ _id: "camp123", name: "Q2 Outreach" });
    expect(result).toEqual({ id: "camp123", name: "Q2 Outreach", status: null, archived: false });
  });
});

describe("transformLead", () => {
  it("reads airtableContactId as flat top-level field", () => {
    const row: Record<string, string | undefined> = {
      _id: "lead1",
      airtableContactId: "recABC",
      lastState: "emailsSent",
      sentStep: "2",
    };
    const result = transformLead(row, "camp1");
    expect(result.airtableContactId).toBe("recABC");
    expect(result.state).toBe("emailsSent");
    expect(result.sequenceStep).toBe(2);
    expect(result.lemlistLeadId).toBe("lead1");
    expect(result.campaignId).toBe("camp1");
  });

  it("returns null airtableContactId when field absent (column missing from CSV)", () => {
    const row: Record<string, string | undefined> = {
      _id: "lead2",
      lastState: "emailsSent",
    };
    const result = transformLead(row, "camp1");
    expect(result.airtableContactId).toBeNull();
  });

  it("maps sentStep '0' to sequenceStep 0 (not null)", () => {
    const row: Record<string, string | undefined> = {
      _id: "lead3",
      sentStep: "0",
    };
    const result = transformLead(row, "camp1");
    expect(result.sequenceStep).toBe(0);
  });

  it("returns sequenceStep null when sentStep absent", () => {
    const row: Record<string, string | undefined> = { _id: "lead4" };
    const result = transformLead(row, "camp1");
    expect(result.sequenceStep).toBeNull();
  });

  it("returns sequenceStep null when sentStep is non-numeric", () => {
    const row: Record<string, string | undefined> = {
      _id: "lead5",
      sentStep: "abc",
    };
    const result = transformLead(row, "camp1");
    expect(result.sequenceStep).toBeNull();
  });

  it("returns totalSequenceSteps as null (not available from export)", () => {
    const row: Record<string, string | undefined> = {
      _id: "lead6",
      sentStep: "3",
    };
    const result = transformLead(row, "camp1");
    expect(result.totalSequenceSteps).toBeNull();
  });

  it("returns assignedAt as null (not in export CSV)", () => {
    const row: Record<string, string | undefined> = { _id: "lead7" };
    const result = transformLead(row, "camp1");
    expect(result.assignedAt).toBeNull();
  });
});

describe("transformActivity", () => {
  it("maps type, occurredAt, sequenceStep, totalSequenceSteps from singular API field", () => {
    const activity = {
      _id: "act1",
      type: "emailsSent",
      createdAt: "2026-01-15T10:00:00Z",
      sequenceStep: 0,
      totalSequenceStep: 6, // API returns singular
    };
    const result = transformActivity(activity);
    expect(result.type).toBe("emailsSent");
    expect(result.occurredAt).toEqual(new Date("2026-01-15T10:00:00Z"));
    expect(result.sequenceStep).toBe(0);
    expect(result.totalSequenceSteps).toBe(6);
  });

  it("returns null for sequenceStep when absent", () => {
    const activity = {
      _id: "act2",
      type: "emailsOpened",
      createdAt: "2026-01-16T08:00:00Z",
    };
    const result = transformActivity(activity);
    expect(result.sequenceStep).toBeNull();
    expect(result.totalSequenceSteps).toBeNull();
  });

  it("uses messagePreview as content when available", () => {
    const activity = {
      _id: "act3",
      type: "emailsSent",
      createdAt: "2026-01-15T10:00:00Z",
      messagePreview: "Hi John,",
    };
    const result = transformActivity(activity);
    expect(result.content).toBe("Hi John,");
  });
});

describe("fetchAllActivities", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.LEMLIST_API_KEY = "test-api-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.LEMLIST_API_KEY;
  });

  it("paginates until empty page and returns all activities combined", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      _id: `act${i}`,
      type: "emailsSent",
      createdAt: "2026-01-15T10:00:00Z",
    }));
    const page2 = Array.from({ length: 50 }, (_, i) => ({
      _id: `act${100 + i}`,
      type: "emailsOpened",
      createdAt: "2026-01-16T10:00:00Z",
    }));

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page2,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    vi.stubGlobal("fetch", mockFetch);

    const results = await fetchAllActivities("camp123");
    expect(results).toHaveLength(150);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify offset increments correctly
    const calls = mockFetch.mock.calls;
    expect(calls[0][0]).toContain("offset=0");
    expect(calls[1][0]).toContain("offset=100");
    expect(calls[2][0]).toContain("offset=150");
  });
});

describe("fetchCampaignLeadsExport", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.LEMLIST_API_KEY = "test-api-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.LEMLIST_API_KEY;
  });

  it("calls /api/campaigns/{id}/export/leads with state=all&format=csv", async () => {
    const csvText = "_id,lastState,sentStep\nlead1,emailsSent,2\n";
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => csvText,
    } as Response);

    await fetchCampaignLeadsExport("camp123");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.lemlist.com/api/campaigns/camp123/export/leads?state=all&format=csv",
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  it("parses CSV rows into Record<string, string> array", async () => {
    const csvText = "_id,lastState,sentStep,airtableContactId\nlead1,emailsSent,2,recABC\nlead2,emailsOpened,5,\n";
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => csvText,
    } as Response);

    const result = await fetchCampaignLeadsExport("camp123");

    expect(result).toHaveLength(2);
    expect(result[0]._id).toBe("lead1");
    expect(result[0].airtableContactId).toBe("recABC");
    expect(result[1].sentStep).toBe("5");
  });

  it("throws on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    await expect(fetchCampaignLeadsExport("camp123")).rejects.toThrow("Lemlist export leads 403");
  });
});
