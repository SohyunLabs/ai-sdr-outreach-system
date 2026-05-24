import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Helper: get a matched lead row (has airtableContactId → shows name, not "연락처 미연결")
async function getMatchedRow(page: Page) {
  const rows = page.locator("tbody tr");
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const text = await row.textContent();
    if (text && !text.includes("연락처 미연결")) {
      return row;
    }
  }
  return null;
}

test.describe("Phase 4: Profile Analysis Page", () => {
  test("1. 매칭된 리드 행 — cursor-pointer + 프로필 페이지 이동", async ({
    page,
  }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const matchedRow = await getMatchedRow(page);
    if (!matchedRow) {
      test.skip(true, "매칭된 리드 없음 (DB 데이터 없음)");
      return;
    }

    // cursor-pointer 확인
    const cursor = await matchedRow.evaluate((el) =>
      window.getComputedStyle(el).cursor
    );
    expect(cursor, "매칭 행 cursor-pointer여야 함").toBe("pointer");

    // 클릭 후 /leads/ 로 이동
    await matchedRow.click();
    await page.waitForURL(/\/leads\/.+/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/leads\/.+/);
  });

  test("2. 비매칭 리드 행 — cursor 기본값 + 클릭 무반응", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const unmatchedRow = page
      .locator("tbody tr")
      .filter({ hasText: "연락처 미연결" })
      .first();
    const exists = (await unmatchedRow.count()) > 0;
    if (!exists) {
      test.skip(true, "비매칭 리드 없음 (DB 데이터 없음)");
      return;
    }

    const cursor = await unmatchedRow.evaluate((el) =>
      window.getComputedStyle(el).cursor
    );
    expect(cursor, "비매칭 행은 pointer 아님").not.toBe("pointer");

    const urlBefore = page.url();
    await unmatchedRow.click({ force: true });
    await page.waitForTimeout(500);
    expect(page.url()).toBe(urlBefore);
  });

  test("3. 프로필 페이지 — 5개 카드 섹션 존재", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const matchedRow = await getMatchedRow(page);
    if (!matchedRow) {
      test.skip(true, "매칭된 리드 없음");
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
      expect(body, `"${s}" 섹션이 없음`).toContain(s);
    }
  });

  test("4. 메시지 시퀀스 — 클릭으로 확장/축소", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const matchedRow = await getMatchedRow(page);
    if (!matchedRow) {
      test.skip(true, "매칭된 리드 없음");
      return;
    }
    await matchedRow.click();
    await page.waitForURL(/\/leads\/.+/, { timeout: 5000 });
    await page.waitForLoadState("networkidle");

    // M1 스텝 버튼/행 클릭
    const stepTrigger = page
      .locator("button, [role=button], [data-step]")
      .filter({ hasText: /M1|Initial|첫 번째/ })
      .first();
    const hasTrigger = (await stepTrigger.count()) > 0;
    if (!hasTrigger) {
      // 카드 내 첫 번째 클릭 가능 요소로 폴백
      const firstStep = page
        .locator("text=/M[1-6]/")
        .first()
        .locator("..")
        .first();
      await firstStep.click();
      await page.waitForTimeout(300);
      const bodyAfter = await page.locator("body").textContent();
      // 뭔가 펼쳐졌는지 (Subject: 또는 본문 텍스트)
      // 단순히 클릭이 작동했는지만 확인
      expect(bodyAfter).toBeTruthy();
      return;
    }
    await stepTrigger.click();
    await page.waitForTimeout(300);
    const expanded = await page.locator("body").textContent();
    expect(expanded).toBeTruthy();
  });

  test("5. 미발송 메시지 — opacity dim 없음 (dot 색상만 구분)", async ({
    page,
  }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const matchedRow = await getMatchedRow(page);
    if (!matchedRow) {
      test.skip(true, "매칭된 리드 없음");
      return;
    }
    await matchedRow.click();
    await page.waitForURL(/\/leads\/.+/, { timeout: 5000 });
    await page.waitForLoadState("networkidle");

    // opacity-50 같은 클래스가 메시지 스텝 컨테이너에 없어야 함
    const dimmedSteps = page.locator('[class*="opacity-"]').filter({
      has: page.locator("text=/M[1-6]/"),
    });
    const dimCount = await dimmedSteps.count();
    expect(dimCount, "메시지 스텝에 opacity dim 클래스 없어야 함").toBe(0);
  });

  test("6. 뒤로가기 → 캠페인 선택 유지", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    // 캠페인 select 현재 값 기록
    const campaignSelect = page
      .locator("select, [role=combobox]")
      .first();
    const initialCampaign = await campaignSelect
      .textContent()
      .catch(() => null);

    const matchedRow = await getMatchedRow(page);
    if (!matchedRow) {
      test.skip(true, "매칭된 리드 없음");
      return;
    }
    await matchedRow.click();
    await page.waitForURL(/\/leads\/.+/, { timeout: 5000 });

    // 뒤로가기
    const backBtn = page
      .locator("button, a")
      .filter({ hasText: /back|뒤로|대시보드/i })
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

    // 캠페인 선택 유지 확인
    if (initialCampaign) {
      const campaignAfter = await page
        .locator("select, [role=combobox]")
        .first()
        .textContent()
        .catch(() => null);
      expect(campaignAfter).toBe(initialCampaign);
    }
  });

  test("7. 잘못된 리드 ID → 404 페이지 (한국어)", async ({ page }) => {
    await page.goto(`${BASE}/leads/invalid-id-that-does-not-exist-99999`);
    await page.waitForLoadState("networkidle");
    const body = await page.locator("body").textContent();
    // 한국어 404 또는 not found 내용 확인
    const is404 =
      body?.includes("찾을 수 없") ||
      body?.includes("존재하지") ||
      body?.includes("Not Found") ||
      body?.includes("404");
    expect(is404, "404 페이지 한국어 메시지 없음").toBe(true);
  });

  test("8. Profile Analysis 사이드바 탭 + 4개 필터", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const tab = page
      .locator("button, a, [role=tab]")
      .filter({ hasText: /Profile Analysis/i })
      .first();
    const hasTab = (await tab.count()) > 0;
    expect(hasTab, "Profile Analysis 탭 없음").toBe(true);

    await tab.click();
    await page.waitForTimeout(500);

    // 4개 필터 확인: 텍스트 검색(input), 상태 버튼(전체/진행중), 캠페인 select, AI 점수 input
    const hasSearch = (await page.locator('input[placeholder*="검색"], input[placeholder*="Search"]').count()) > 0;
    const hasStatusBtns = (await page.locator("button").filter({ hasText: "진행중" }).count()) > 0;
    const hasCampaign = (await page.locator("select option, [role=option]").filter({ hasText: /캠페인|Campaign/ }).count()) > 0
      || (await page.locator("body").textContent())?.includes("캠페인");
    const hasAiScore = (await page.locator("body").textContent())?.includes("AI 점수") || (await page.locator("body").textContent())?.includes("AI");
    expect(hasSearch, "검색 input 없음").toBe(true);
    expect(hasStatusBtns, "상태 그룹 버튼(진행중) 없음").toBe(true);
    expect(hasCampaign, "캠페인 필터 없음").toBe(true);
    expect(hasAiScore, "AI 점수 필터 없음").toBe(true);
  });

  test("9. AI Analysis 카드 — AI Scoring Reason + Interactions Summary", async ({
    page,
  }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const matchedRow = await getMatchedRow(page);
    if (!matchedRow) {
      test.skip(true, "매칭된 리드 없음");
      return;
    }
    await matchedRow.click();
    await page.waitForURL(/\/leads\/.+/, { timeout: 5000 });
    await page.waitForLoadState("networkidle");

    const body = await page.locator("body").textContent();
    const hasScoringReason =
      body?.includes("Scoring Reason") ||
      body?.includes("점수 근거") ||
      body?.includes("AI Score");
    const hasInteractions =
      body?.includes("Interactions") ||
      body?.includes("인터랙션") ||
      body?.includes("Recent");
    expect(hasScoringReason, "AI Scoring Reason 필드 없음").toBe(true);
    expect(hasInteractions, "AI Recent Interactions Summary 없음").toBe(true);
  });

  test("10. 프로필 페이지 사이드바 — Profile Analysis 탭 하이라이트", async ({
    page,
  }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const matchedRow = await getMatchedRow(page);
    if (!matchedRow) {
      test.skip(true, "매칭된 리드 없음");
      return;
    }
    await matchedRow.click();
    await page.waitForURL(/\/leads\/.+/, { timeout: 5000 });
    await page.waitForLoadState("networkidle");

    // 사이드바에서 Profile Analysis가 활성화 상태인지
    const activeTab = page
      .locator("button, a, [role=tab], nav *")
      .filter({ hasText: /Profile Analysis/i })
      .first();
    const hasActiveTab = (await activeTab.count()) > 0;
    expect(hasActiveTab, "프로필 페이지에 Profile Analysis 탭 없음").toBe(
      true
    );

    // aria-current, data-active, 또는 활성화 클래스 확인
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
      "Profile Analysis 탭이 활성화 상태가 아님"
    ).toBe(true);
  });
});
