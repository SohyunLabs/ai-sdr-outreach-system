import { describe, it, expect } from "vitest";
import { selectPrimaryLead } from "@/lib/dashboard-utils";
import type { ContactLeadSummary } from "@/lib/dashboard-utils";

const makeLead = (state: string | null, id = "1"): ContactLeadSummary => ({
  id,
  campaignId: "c1",
  campaignName: "Test Campaign",
  state,
  sequenceStep: null,
  totalSequenceSteps: null,
});

describe("selectPrimaryLead", () => {
  it("returns null for empty array", () => {
    expect(selectPrimaryLead([])).toBeNull();
  });

  it("returns BLUE_STATES lead first (CAMP-01)", () => {
    const leads = [makeLead("done", "a"), makeLead("emailsSent", "b")];
    const result = selectPrimaryLead(leads);
    expect(result?.state).toBe("emailsSent");
  });

  it("returns first lead when no active lead exists (CAMP-02)", () => {
    const leads = [makeLead("done", "a"), makeLead("notInterested", "b")];
    const result = selectPrimaryLead(leads);
    expect(result?.id).toBe("a");
  });

  it("returns first lead when all states are null", () => {
    const leads = [makeLead(null, "a")];
    expect(selectPrimaryLead(leads)?.id).toBe("a");
  });
});
