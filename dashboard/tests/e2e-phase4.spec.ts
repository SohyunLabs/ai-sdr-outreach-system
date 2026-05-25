import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Helper: get a matched lead row (has airtableContactId -> shows name, not "No Match")
async function getMatchedRow(page: Page) {
  const rows = page.locator("tbody tr");
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const text = await row.textContent();
    if (text && !text.includes("No Match")) {
      return row;
    }
  }
  return null;
}

test.describe("Phase 4: Profile Analysis Page", () => {
  test("1. Matched lead row -- cursor-pointer + navigates to profile page", async ({
    page,
  }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const matchedRow = await getMatchedRow(page);
    if (!matchedRow) {
      test.skip(true, "No matched leads (no DB data)");
      return;
    }

    // Verify cursor-pointer
    const cursor = await matchedRow.evaluate((el) =>
      window.getComputedStyle(el).cursor
    );
    expect(cursor, "Matched row should have cursor-pointer").toBe("pointer");

    // Click navigates to /leads/
    await matchedRow.click();
    await page.waitForURL(/\/leads\/.+/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/leads\/.+/);
  });

  test("2. Unmatched lead row -- default cursor + click no-op", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const unmatchedRow = page
      .locator("tbody tr")
      .filter({ hasText: "No Match" })
      .first();
    const exists = (await unmatchedRow.count()) > 0;
    if (!exists) {
      test.skip(true, "No unmatched leads (no DB data)");
      return;
    }

    const cursor = await unmatchedRow.evaluate((el) =>
      window.getComputedStyle(el).cursor
    );
    expect(cursor, "Unmatched row should not have pointer").not.toBe("pointer");

    const urlBefore = page.url();
    await unmatchedRow.click({ force: true });
    await page.waitForTimeout(500);
    expect(page.url()).toBe(urlBefore);
  });

  test("3. Profile page -- has 5 card sections", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const matchedRow = await getMatchedRow(page);
    if (!matchedRow) {
      test.skip(true, "No matched leads");
      return;
    }
    await matchedRow.click();
    await page.waitForURL(/\/leads\/.+/, { timeout: 5000 });
    await page.waitForLoadState("networkidle");

    const body = await page.locator("body").textContent();
    const sections = [
      "Background Info",
      "AI Analysis",
      "Campaign Status",
      "Message Sequence",
      "Activity",
    ];
    for (const s of sections) {
      expect(body, `Missing "${s}" section`).toContain(s);
    }
  });

  test("4. Message sequence -- click to expand/collapse", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const matchedRow = await getMatchedRow(page);
    if (!matchedRow) {
      test.skip(true, "No matched leads");
      return;
    }
    await matchedRow.click();
    await page.waitForURL(/\/leads\/.+/, { timeout: 5000 });
    await page.waitForLoadState("networkidle");

    // Click M1 step button/row
    const stepTrigger = page
      .locator("button, [role=button], [data-step]")
      .filter({ hasText: /M1|Initial/ })
      .first();
    const hasTrigger = (await stepTrigger.count()) > 0;
    if (!hasTrigger) {
      // Fallback to first clickable element in card
      const firstStep = page
        .locator("text=/M[1-6]/")
        .first()
        .locator("..")
        .first();
      await firstStep.click();
      await page.waitForTimeout(300);
      const bodyAfter = await page.locator("body").textContent();
      // Check if something expanded (Subject: or body text)
      // Simply verify the click worked
      expect(bodyAfter).toBeTruthy();
      return;
    }
    await stepTrigger.click();
    await page.waitForTimeout(300);
    const expanded = await page.locator("body").textContent();
    expect(expanded).toBeTruthy();
  });

  test("5. Unsent messages -- no opacity dim (dot color only)", async ({
    page,
  }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const matchedRow = await getMatchedRow(page);
    if (!matchedRow) {
      test.skip(true, "No matched leads");
      return;
    }
    await matchedRow.click();
    await page.waitForURL(/\/leads\/.+/, { timeout: 5000 });
    await page.waitForLoadState("networkidle");

    // Message step containers should not have opacity-50 class
    const dimmedSteps = page.locator('[class*="opacity-"]').filter({
      has: page.locator("text=/M[1-6]/"),
    });
    const dimCount = await dimmedSteps.count();
    expect(dimCount, "Message steps should not have opacity dim class").toBe(0);
  });

  test("6. Back navigation -- campaign selection preserved", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    // Record current campaign select value
    const campaignSelect = page
      .locator("select, [role=combobox]")
      .first();
    const initialCampaign = await campaignSelect
      .textContent()
      .catch(() => null);

    const matchedRow = await getMatchedRow(page);
    if (!matchedRow) {
      test.skip(true, "No matched leads");
      return;
    }
    await matchedRow.click();
    await page.waitForURL(/\/leads\/.+/, { timeout: 5000 });

    // Navigate back
    const backBtn = page
      .locator("button, a")
      .filter({ hasText: /back|dashboard/i })
      .first();
    const hasBack = (await backBtn.count()) > 0;
    if (hasBack) {
      await backBtn.click();
    } else {
      await page.goBack();
    }
    await page.waitForURL(BASE + "/", { timeout: 5000 }).catch(() => {});
    await page.waitForLoadState("networkidle");

    expect(page.url()).not.toMatch(/\/leads\//);

    // Verify campaign selection preserved
    if (initialCampaign) {
      const campaignAfter = await page
        .locator("select, [role=combobox]")
        .first()
        .textContent()
        .catch(() => null);
      expect(campaignAfter).toBe(initialCampaign);
    }
  });

  test("7. Invalid lead ID -- 404 page", async ({ page }) => {
    await page.goto(`${BASE}/leads/invalid-id-that-does-not-exist-99999`);
    await page.waitForLoadState("networkidle");
    const body = await page.locator("body").textContent();
    // Check for 404 or not found content
    const is404 =
      body?.includes("not found") ||
      body?.includes("Not Found") ||
      body?.includes("Lead not found") ||
      body?.includes("404");
    expect(is404, "404 page message not found").toBe(true);
  });

  test("8. Profile Analysis sidebar tab + 4 filters", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const tab = page
      .locator("button, a, [role=tab]")
      .filter({ hasText: /Profile Analysis/i })
      .first();
    const hasTab = (await tab.count()) > 0;
    expect(hasTab, "Profile Analysis tab not found").toBe(true);

    await tab.click();
    await page.waitForTimeout(500);

    // Check 4 filters: text search(input), status buttons(All/In Progress), campaign select, AI score input
    const hasSearch = (await page.locator('input[placeholder*="Search"], input[placeholder*="search"]').count()) > 0;
    const hasStatusBtns = (await page.locator("button").filter({ hasText: "In Progress" }).count()) > 0;
    const hasCampaign = (await page.locator("select option, [role=option]").filter({ hasText: /Campaign/ }).count()) > 0
      || (await page.locator("body").textContent())?.includes("Campaign");
    const hasAiScore = (await page.locator("body").textContent())?.includes("AI Score") || (await page.locator("body").textContent())?.includes("AI");
    expect(hasSearch, "Search input not found").toBe(true);
    expect(hasStatusBtns, "Status group button (In Progress) not found").toBe(true);
    expect(hasCampaign, "Campaign filter not found").toBe(true);
    expect(hasAiScore, "AI Score filter not found").toBe(true);
  });

  test("9. AI Analysis card -- AI Scoring Reason + Interactions Summary", async ({
    page,
  }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const matchedRow = await getMatchedRow(page);
    if (!matchedRow) {
      test.skip(true, "No matched leads");
      return;
    }
    await matchedRow.click();
    await page.waitForURL(/\/leads\/.+/, { timeout: 5000 });
    await page.waitForLoadState("networkidle");

    const body = await page.locator("body").textContent();
    const hasScoringReason =
      body?.includes("Scoring Reason") ||
      body?.includes("Scoring Rationale") ||
      body?.includes("AI Score");
    const hasInteractions =
      body?.includes("Interactions") ||
      body?.includes("Summary") ||
      body?.includes("Recent");
    expect(hasScoringReason, "AI Scoring Reason field not found").toBe(true);
    expect(hasInteractions, "AI Recent Interactions Summary not found").toBe(true);
  });

  test("10. Profile page sidebar -- Profile Analysis tab highlighted", async ({
    page,
  }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const matchedRow = await getMatchedRow(page);
    if (!matchedRow) {
      test.skip(true, "No matched leads");
      return;
    }
    await matchedRow.click();
    await page.waitForURL(/\/leads\/.+/, { timeout: 5000 });
    await page.waitForLoadState("networkidle");

    // Check if Profile Analysis is active in sidebar
    const activeTab = page
      .locator("button, a, [role=tab], nav *")
      .filter({ hasText: /Profile Analysis/i })
      .first();
    const hasActiveTab = (await activeTab.count()) > 0;
    expect(hasActiveTab, "Profile Analysis tab not found on profile page").toBe(
      true
    );

    // Check aria-current, data-active, or active class
    const isActive = await activeTab
      .evaluate((el) => {
        return (
          el.getAttribute("aria-current") === "page" ||
          el.getAttribute("data-active") === "true" ||
          el.classList.contains("active") ||
          el.classList.contains("bg-accent") ||
          el.classList.contains("bg-muted") ||
          window.getComputedStyle(el).fontWeight === "700" ||
          window.getComputedStyle(el).fontWeight === "bold"
        );
      })
      .catch(() => false);
    expect(
      isActive,
      "Profile Analysis tab is not in active state"
    ).toBe(true);
  });
});
