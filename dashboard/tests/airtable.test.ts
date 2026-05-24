import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  transformContact,
  fetchAllAirtableRecords,
  type AirtableRecord,
} from "../lib/airtable";

describe("transformContact", () => {
  it("maps all fields when present", () => {
    const record: AirtableRecord = {
      id: "rec123",
      createdTime: "2024-01-01T00:00:00.000Z",
      fields: {
        "Contact_Name": "Alice",
        "Current_Company": "Acme",
        "Contact Profile": "CTO",
        "AI Score (Profile)": 85.5,
        "AI Scoring Reason (Profile)": "Strong technical background",
        "AI Recent_Interactions_summary (Profile)": "Engaged at SaaS conference",
        "Email": "a@b.com",
        "Profile_Url": "https://li.com/in/alice",
      },
    };

    const result = transformContact(record);

    expect(result).toEqual({
      airtableId: "rec123",
      name: "Alice",
      company: "Acme",
      role: "CTO",
      aiScore: 85.5,
      aiScoringReason: "Strong technical background",
      aiRecentInteractionsSummary: "Engaged at SaaS conference",
      email: "a@b.com",
      linkedinUrl: "https://li.com/in/alice",
      country: null,
      follower: null,
      connection: null,
      about: null,
      experiences: null,
    });
  });

  it("returns nulls when fields object is empty", () => {
    const record: AirtableRecord = {
      id: "rec456",
      createdTime: "2024-01-01T00:00:00.000Z",
      fields: {},
    };

    const result = transformContact(record);

    expect(result).toEqual({
      airtableId: "rec456",
      name: null,
      company: null,
      role: null,
      aiScore: null,
      aiScoringReason: null,
      aiRecentInteractionsSummary: null,
      email: null,
      linkedinUrl: null,
      country: null,
      follower: null,
      connection: null,
      about: null,
      experiences: null,
    });
  });
});


describe("fetchAllAirtableRecords", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("paginates through 2 pages and returns combined records", async () => {
    const page1Records = [
      { id: "rec001", createdTime: "2024-01-01T00:00:00.000Z", fields: { Name: "Alice" } },
      { id: "rec002", createdTime: "2024-01-01T00:00:00.000Z", fields: { Name: "Bob" } },
    ];
    const page2Records = [
      { id: "rec003", createdTime: "2024-01-01T00:00:00.000Z", fields: { Name: "Charlie" } },
    ];

    let callCount = 0;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      callCount++;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({ records: page1Records, offset: "itrNextPage123" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      // Page 2: no offset
      return new Response(
        JSON.stringify({ records: page2Records }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    // Set required env vars
    process.env.AIRTABLE_PAT = "test-pat";
    process.env.AIRTABLE_BASE_ID = "appTestBase";

    const records = await fetchAllAirtableRecords("tblTestTable");

    expect(records).toHaveLength(3);
    expect(records[0].id).toBe("rec001");
    expect(records[1].id).toBe("rec002");
    expect(records[2].id).toBe("rec003");
    expect(callCount).toBe(2);
  });
});
