import { describe, it, expect } from "vitest";
import {
  getStatusColor,
  getStatusSortOrder,
} from "@/lib/status-colors";
import {
  computeSummary,
  formatSyncTimestamp,
} from "@/lib/dashboard-data";
import type { CampaignLeadWithContact } from "@/lib/dashboard-data";

// ─── getStatusColor ────────────────────────────────────────────────────────────

describe("getStatusColor", () => {
  it("returns blue classes for emailsSent (blue group)", () => {
    expect(getStatusColor("emailsSent")).toBe("bg-blue-500 text-white");
  });

  it("returns blue classes for emailsOpened", () => {
    expect(getStatusColor("emailsOpened")).toBe("bg-blue-500 text-white");
  });

  it("returns green classes for emailsReplied", () => {
    expect(getStatusColor("emailsReplied")).toBe("bg-green-500 text-white");
  });

  it("returns green classes for interested", () => {
    expect(getStatusColor("interested")).toBe("bg-green-500 text-white");
  });

  it("returns red classes for emailsBounced", () => {
    expect(getStatusColor("emailsBounced")).toBe("bg-red-500 text-white");
  });

  it("returns red classes for unsubscribed", () => {
    expect(getStatusColor("unsubscribed")).toBe("bg-red-500 text-white");
  });

  it("returns gray classes for paused", () => {
    expect(getStatusColor("paused")).toBe("bg-gray-400 text-white");
  });

  it("returns default gray for unknown state", () => {
    expect(getStatusColor("unknownState")).toBe("bg-gray-400 text-white");
  });

  it("returns default gray for null", () => {
    expect(getStatusColor(null)).toBe("bg-gray-400 text-white");
  });
});

// ─── getStatusSortOrder ────────────────────────────────────────────────────────

describe("getStatusSortOrder", () => {
  it("returns 1 for blue group (emailsSent)", () => {
    expect(getStatusSortOrder("emailsSent")).toBe(1);
  });

  it("returns 1 for blue group (emailsOpened)", () => {
    expect(getStatusSortOrder("emailsOpened")).toBe(1);
  });

  it("returns 2 for red group (emailsBounced)", () => {
    expect(getStatusSortOrder("emailsBounced")).toBe(2);
  });

  it("returns 3 for green group (emailsReplied)", () => {
    expect(getStatusSortOrder("emailsReplied")).toBe(3);
  });

  it("returns 4 for gray group (paused)", () => {
    expect(getStatusSortOrder("paused")).toBe(4);
  });

  it("returns 4 for null", () => {
    expect(getStatusSortOrder(null)).toBe(4);
  });

  it("returns 4 for unknown state", () => {
    expect(getStatusSortOrder("unknownXYZ")).toBe(4);
  });
});

// ─── computeSummary ────────────────────────────────────────────────────────────

function makeLead(state: string | null): CampaignLeadWithContact {
  return {
    id: "id",
    lemlistLeadId: "ll",
    campaignId: "c1",
    airtableContactId: null,
    state,
    lemlistStatus: null,
    sequenceStep: null,
    totalSequenceSteps: null,
    sequenceType: null,
    activities: [],
    contact: null,
  };
}

describe("computeSummary", () => {
  it("returns all zeros for empty array", () => {
    const result = computeSummary([]);
    expect(result).toEqual({ total: 0, waiting: 0, inProgress: 0, replied: 0, bouncedFailed: 0 });
  });

  it("counts mixed states correctly", () => {
    const leads: CampaignLeadWithContact[] = [
      makeLead("emailsSent"),
      makeLead("emailsSent"),
      makeLead("emailsSent"),
      makeLead("emailsReplied"),
      makeLead("emailsReplied"),
      makeLead("emailsBounced"),
    ];
    const result = computeSummary(leads);
    expect(result).toEqual({ total: 6, waiting: 0, inProgress: 3, replied: 2, bouncedFailed: 1 });
  });

  it("counts paused/done as neither inProgress nor replied nor bouncedFailed", () => {
    const leads = [makeLead("paused"), makeLead("done")];
    const result = computeSummary(leads);
    expect(result).toEqual({ total: 2, waiting: 0, inProgress: 0, replied: 0, bouncedFailed: 0 });
  });

  it("handles null state leads", () => {
    const leads = [makeLead(null), makeLead("emailsSent")];
    const result = computeSummary(leads);
    expect(result).toEqual({ total: 2, waiting: 0, inProgress: 1, replied: 0, bouncedFailed: 0 });
  });
});

// ─── formatSyncTimestamp ───────────────────────────────────────────────────────

describe("formatSyncTimestamp", () => {
  it("formats a valid date as 마지막 동기화: MM/DD HH:MM", () => {
    const d = new Date("2026-04-03T14:35:00");
    const result = formatSyncTimestamp(d);
    const mo = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const expected = `마지막 동기화: ${mo}/${day} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    expect(result).toBe(expected);
  });

  it("pads single-digit month, day, hours and minutes", () => {
    const d = new Date("2026-04-03T05:07:00");
    const result = formatSyncTimestamp(d);
    const mo = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const expected = `마지막 동기화: ${mo}/${day} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    expect(result).toBe(expected);
  });

  it("returns 동기화 기록 없음 for null", () => {
    expect(formatSyncTimestamp(null)).toBe("동기화 기록 없음");
  });
});
