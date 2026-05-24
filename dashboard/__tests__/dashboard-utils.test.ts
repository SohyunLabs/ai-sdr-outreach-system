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
  it("빈 배열에서 null 반환", () => {
    expect(selectPrimaryLead([])).toBeNull();
  });

  it("BLUE_STATES lead를 우선 반환 (CAMP-01)", () => {
    const leads = [makeLead("done", "a"), makeLead("emailsSent", "b")];
    const result = selectPrimaryLead(leads);
    expect(result?.state).toBe("emailsSent");
  });

  it("active lead가 없으면 첫 번째 lead 반환 (CAMP-02)", () => {
    const leads = [makeLead("done", "a"), makeLead("notInterested", "b")];
    const result = selectPrimaryLead(leads);
    expect(result?.id).toBe("a");
  });

  it("state가 null인 lead만 있으면 첫 번째 반환", () => {
    const leads = [makeLead(null, "a")];
    expect(selectPrimaryLead(leads)?.id).toBe("a");
  });
});
