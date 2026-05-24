import { describe, it, expect } from "vitest";
import {
  formatActivityTimestamp,
  STEP_META,
  buildSteps,
  deriveSentSteps,
} from "@/lib/lead-profile-utils";

// ─── formatActivityTimestamp ───────────────────────────────────────────────────

describe("formatActivityTimestamp", () => {
  it("formats 2024-03-15T09:05:00Z as YYYY-MM-DD HH:MM", () => {
    const d = new Date("2024-03-15T09:05:00Z");
    const result = formatActivityTimestamp(d);
    // Use the same padded values as the function would produce
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    expect(result).toBe(`${y}-${mo}-${day} ${h}:${m}`);
  });

  it("formats 2024-12-01T23:59:00Z correctly", () => {
    const d = new Date("2024-12-01T23:59:00Z");
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    expect(formatActivityTimestamp(d)).toBe(`${y}-${mo}-${day} ${h}:${m}`);
  });

  it("pads single-digit month, day, hour, minute", () => {
    // Create a date with known local values
    const d = new Date(2024, 2, 5, 9, 7); // March 5, 09:07 local time
    expect(formatActivityTimestamp(d)).toBe("2024-03-05 09:07");
  });
});

// ─── STEP_META ─────────────────────────────────────────────────────────────────

describe("STEP_META", () => {
  it("has exactly 6 entries", () => {
    expect(STEP_META).toHaveLength(6);
  });

  it("entries 0-2 are email channel", () => {
    expect(STEP_META[0]).toMatchObject({ index: 0, label: "M1", channel: "email" });
    expect(STEP_META[1]).toMatchObject({ index: 1, label: "M2", channel: "email" });
    expect(STEP_META[2]).toMatchObject({ index: 2, label: "M3", channel: "email" });
  });

  it("entries 3-4 are linkedin channel", () => {
    expect(STEP_META[3]).toMatchObject({ index: 3, label: "M4", channel: "linkedin" });
    expect(STEP_META[4]).toMatchObject({ index: 4, label: "M5", channel: "linkedin" });
  });

  it("entry 5 is email channel", () => {
    expect(STEP_META[5]).toMatchObject({ index: 5, label: "M6", channel: "email" });
  });
});

// ─── buildSteps ────────────────────────────────────────────────────────────────

describe("buildSteps", () => {
  it("returns 6 steps when message is null", () => {
    const steps = buildSteps(null);
    expect(steps).toHaveLength(6);
  });

  it("all subject and body are null when message is null", () => {
    const steps = buildSteps(null);
    for (const step of steps) {
      expect(step.subject).toBeNull();
      expect(step.body).toBeNull();
    }
  });

  it("M1 uses m1Subject and m1BodyEmail", () => {
    const msg = {
      m1Subject: "Hello World",
      m1BodyEmail: "Body 1",
      m2Subject: null, m2BodyEmail: null,
      m3Subject: null, m3BodyEmail: null,
      m4LiConnReq: null,
      m5LiChat: null,
      m6Subject: null, m6BodyEmail: null,
    };
    const steps = buildSteps(msg);
    expect(steps[0].subject).toBe("Hello World");
    expect(steps[0].body).toBe("Body 1");
  });

  it("M4 uses fixed subject 'LinkedIn 연결 요청' and m4LiConnReq as body", () => {
    const msg = {
      m1Subject: null, m1BodyEmail: null,
      m2Subject: null, m2BodyEmail: null,
      m3Subject: null, m3BodyEmail: null,
      m4LiConnReq: "Connect with me",
      m5LiChat: null,
      m6Subject: null, m6BodyEmail: null,
    };
    const steps = buildSteps(msg);
    expect(steps[3].subject).toBe("LinkedIn 연결 요청");
    expect(steps[3].body).toBe("Connect with me");
  });

  it("M5 uses fixed subject 'LinkedIn 채팅' and m5LiChat as body", () => {
    const msg = {
      m1Subject: null, m1BodyEmail: null,
      m2Subject: null, m2BodyEmail: null,
      m3Subject: null, m3BodyEmail: null,
      m4LiConnReq: null,
      m5LiChat: "Hi there",
      m6Subject: null, m6BodyEmail: null,
    };
    const steps = buildSteps(msg);
    expect(steps[4].subject).toBe("LinkedIn 채팅");
    expect(steps[4].body).toBe("Hi there");
  });

  it("M6 uses m6Subject and m6BodyEmail", () => {
    const msg = {
      m1Subject: null, m1BodyEmail: null,
      m2Subject: null, m2BodyEmail: null,
      m3Subject: null, m3BodyEmail: null,
      m4LiConnReq: null,
      m5LiChat: null,
      m6Subject: "Follow up",
      m6BodyEmail: "Final email",
    };
    const steps = buildSteps(msg);
    expect(steps[5].subject).toBe("Follow up");
    expect(steps[5].body).toBe("Final email");
  });

  it("each step has correct index, label, channel from STEP_META", () => {
    const steps = buildSteps(null);
    for (let i = 0; i < 6; i++) {
      expect(steps[i].index).toBe(STEP_META[i].index);
      expect(steps[i].label).toBe(STEP_META[i].label);
      expect(steps[i].channel).toBe(STEP_META[i].channel);
    }
  });
});

// ─── deriveSentSteps ───────────────────────────────────────────────────────────

describe("deriveSentSteps", () => {
  it("returns empty Set for empty activities", () => {
    const result = deriveSentSteps([]);
    expect(result.size).toBe(0);
  });

  it("includes sequenceStep for emailsSent activity", () => {
    const result = deriveSentSteps([{ type: "emailsSent", sequenceStep: 0 }]);
    expect(result.has(0)).toBe(true);
    expect(result.size).toBe(1);
  });

  it("does NOT double-count emailsSent and emailsOpened for same step", () => {
    const result = deriveSentSteps([
      { type: "emailsSent", sequenceStep: 0 },
      { type: "emailsOpened", sequenceStep: 0 },
    ]);
    // emailsOpened is NOT a sent event, so only emailsSent contributes
    expect(result.has(0)).toBe(true);
    expect(result.size).toBe(1);
  });

  it("includes sequenceStep for linkedinSent activity", () => {
    const result = deriveSentSteps([{ type: "linkedinSent", sequenceStep: 3 }]);
    expect(result.has(3)).toBe(true);
    expect(result.size).toBe(1);
  });

  it("does NOT include emailsReplied (not a sent event)", () => {
    const result = deriveSentSteps([{ type: "emailsReplied", sequenceStep: 1 }]);
    expect(result.size).toBe(0);
  });

  it("ignores activities with null sequenceStep", () => {
    const result = deriveSentSteps([{ type: "emailsSent", sequenceStep: null }]);
    expect(result.size).toBe(0);
  });

  it("handles multiple sent activities across different steps", () => {
    const result = deriveSentSteps([
      { type: "emailsSent", sequenceStep: 0 },
      { type: "linkedinSent", sequenceStep: 3 },
      { type: "emailsSent", sequenceStep: 1 },
      { type: "emailsOpened", sequenceStep: 0 },
    ]);
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(true);
    expect(result.has(3)).toBe(true);
    expect(result.size).toBe(3);
  });
});
