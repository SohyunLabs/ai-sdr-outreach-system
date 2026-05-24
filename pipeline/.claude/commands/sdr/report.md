# /sdr:report — Campaign Performance Report

Fitogether AI SDR 캠페인 전체 현황을 조회하고, 인사이트와 수동 액션이 필요한 파이프라인을 리포트로 출력한다.

---

## Step 1: DB 데이터 조회

프로젝트 루트에서 아래 Node.js 코드를 Bash로 실행한다:

```javascript
const { Pool } = require('./node_modules/pg');
const fs = require('fs');

const envRaw = fs.readFileSync('.env', 'utf8');
const env = {};
envRaw.split('\n').forEach(line => {
  const m = line.match(/^([^#=\s]+)\s*=\s*"?([^"]*)"?$/);
  if (m) env[m[1]] = m[2];
});

const pool = new Pool({ connectionString: env.DATABASE_URL_UNPOOLED });

async function run() {
  const [funnel, campaigns, leads, notLaunched] = await Promise.all([

    // 누적 퍼널
    pool.query(`
      SELECT
        (
          SELECT COALESCE(SUM(sub.launched + sub.pending), 0)
          FROM (
            SELECT
              c2.campaign_id,
              COUNT(DISTINCT cl2.airtable_contact_id) AS launched,
              (
                SELECT COUNT(DISTINCT m2.contact_id)
                FROM messages m2
                WHERE m2.campaign_id = c2.campaign_id
                  AND NOT EXISTS (
                    SELECT 1 FROM campaign_leads cl3
                    WHERE cl3.campaign_id = m2.campaign_id
                      AND cl3.airtable_contact_id = m2.contact_id
                  )
              ) AS pending
            FROM campaigns c2
            LEFT JOIN campaign_leads cl2
              ON cl2.campaign_id = c2.campaign_id
              AND cl2.removed_from_lemlist = false
            WHERE c2.archived = false
            GROUP BY c2.campaign_id
          ) sub
        ) AS messages_generated,
        COUNT(DISTINCT cl.airtable_contact_id) AS launched,
        COUNT(DISTINCT CASE WHEN a.type = 'linkedinInviteDone' THEN cl.airtable_contact_id END) AS li_invite_sent,
        COUNT(DISTINCT CASE WHEN a.type = 'linkedinInviteAccepted' THEN cl.airtable_contact_id END) AS li_accepted,
        COUNT(DISTINCT CASE WHEN a.type IN ('emailsSent','linkedinMessageSent','linkedinSent') THEN cl.airtable_contact_id END) AS message_sent,
        COUNT(DISTINCT CASE WHEN a.type IN ('emailsOpened','linkedinOpened') THEN cl.airtable_contact_id END) AS message_opened,
        COUNT(DISTINCT CASE WHEN a.type IN ('emailsReplied','linkedinReplied') THEN cl.airtable_contact_id END) AS replied
      FROM campaign_leads cl
      LEFT JOIN activities a ON a.campaign_lead_id = cl.id
      WHERE cl.removed_from_lemlist = false
    `),

    // 캠페인별 성과
    pool.query(`
      SELECT
        c.name, c.status,
        (SELECT COUNT(DISTINCT m.contact_id) FROM messages m WHERE m.campaign_id = c.campaign_id) AS messages_generated,
        COUNT(DISTINCT cl.id) AS total_leads,
        COUNT(DISTINCT CASE WHEN a.type IN ('emailsSent','linkedinMessageSent','linkedinSent') THEN cl.id END) AS message_sent,
        COUNT(DISTINCT CASE WHEN a.type = 'linkedinInviteDone' THEN cl.id END) AS li_invite_sent,
        COUNT(DISTINCT CASE WHEN a.type IN ('emailsOpened','linkedinOpened') THEN cl.id END) AS message_opened,
        COUNT(DISTINCT CASE WHEN a.type = 'linkedinInviteAccepted' THEN cl.id END) AS li_accepted,
        COUNT(DISTINCT CASE WHEN a.type IN ('emailsReplied','linkedinReplied') THEN cl.id END) AS replied,
        COUNT(DISTINCT CASE WHEN a.type IN ('linkedinSendFailed','emailsBounced','emailsFailed') THEN cl.id END) AS failed
      FROM campaigns c
      LEFT JOIN campaign_leads cl ON c.campaign_id = cl.campaign_id AND cl.removed_from_lemlist = false
      LEFT JOIN activities a ON a.campaign_lead_id = cl.id
      WHERE c.archived = false
      GROUP BY c.campaign_id, c.name, c.status
      ORDER BY
        CASE c.status WHEN 'running' THEN 0 WHEN 'draft' THEN 1 WHEN 'paused' THEN 2 WHEN 'ended' THEN 3 ELSE 4 END,
        total_leads DESC
    `),

    // 전체 리드 상세 (파이프라인 + AI 관찰용)
    pool.query(`
      SELECT
        co.name, co.company, co.country, co.assignee,
        c.name AS campaign, c.status AS campaign_status,
        cl.id AS lead_id, cl.state,
        cl.sequence_step, cl.total_sequence_steps,
        (SELECT a.type FROM activities a WHERE a.campaign_lead_id = cl.id ORDER BY a.occurred_at DESC LIMIT 1) AS last_activity,
        (SELECT a.occurred_at FROM activities a WHERE a.campaign_lead_id = cl.id ORDER BY a.occurred_at DESC LIMIT 1) AS last_activity_at,
        (SELECT COUNT(*) FROM activities a WHERE a.campaign_lead_id = cl.id AND a.type IN ('emailsReplied','linkedinReplied')) AS reply_count,
        (SELECT MIN(a.occurred_at) FROM activities a WHERE a.campaign_lead_id = cl.id AND a.type IN ('emailsReplied','linkedinReplied')) AS first_reply_at
      FROM campaign_leads cl
      JOIN campaigns c ON c.campaign_id = cl.campaign_id
      LEFT JOIN contacts co ON co.airtable_id = cl.airtable_contact_id
      WHERE cl.removed_from_lemlist = false
      ORDER BY c.name, co.name
    `),

    // 메시지 생성됐으나 캠페인 미등록 (Lemlist 런치 안 함)
    pool.query(`
      SELECT co.name, co.company, co.country, co.assignee
      FROM contacts co
      WHERE EXISTS (SELECT 1 FROM messages m WHERE m.contact_id = co.airtable_id)
        AND co.airtable_id NOT IN (
          SELECT DISTINCT airtable_contact_id FROM campaign_leads
          WHERE airtable_contact_id IS NOT NULL AND removed_from_lemlist = false
        )
      ORDER BY co.assignee NULLS LAST, co.name
    `)
  ]);

  console.log(JSON.stringify({
    funnel: funnel.rows[0],
    campaigns: campaigns.rows,
    leads: leads.rows,
    notLaunched: notLaunched.rows
  }, null, 2));

  pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
```

---

## Step 2: 리포트 작성

조회된 데이터를 바탕으로 Slack mrkdwn 형식으로 리포트를 작성한다.

*포맷 규칙:*
- 이모지 사용 금지
- bold는 `*텍스트*`, 구분선은 `━━━━━━━━━━━━━━━`
- Slack은 마크다운 테이블(`| col |`)을 지원하지 않는다. 모든 데이터는 bullet list(`-`)로 표시한다.
- 각 캠페인/리드 항목 뒤에 `→`로 시작하는 액션 코멘트를 한 줄 추가한다.

### 헤더

```
*AI SDR 아웃리치 캠페인 리포트* | {오늘 날짜}
```

---

### 섹션 1: 퍼널 현황 (누적)

이메일과 LinkedIn은 퍼널 구조가 다르므로 캠페인 유형별로 분리 표기한다.

*전체 파이프라인* — `funnel` + `notLaunched` 데이터:
- 메시지 생성 완료: `messages_generated`명
- 캠페인 등록 (발송 시작): `launched`명
- 미등록 대기: `notLaunched.length`명

*LinkedIn 전용 캠페인* — `campaigns`에서 LinkedIn 전용 캠페인만 합산:
- 초대 발송: `li_invite_sent`명 → 연결 수락: `li_accepted`명 (수락율: li_accepted / li_invite_sent) → 답장: `replied`명 (수락 후 전환율: replied / li_accepted)
- 발송 실패: `failed`명 (실패율: failed / li_invite_sent)

*이메일 전용 캠페인* — `campaigns`에서 이메일 전용 캠페인만 합산:
- 발송: `message_sent`명 → 오픈: `message_opened`명 (오픈율: message_opened / message_sent) → 답장: `replied`명 (답장율: replied / message_sent)
- 바운스: 바운스 수 (바운스율: bounced / message_sent)

*혼합 캠페인* — 이메일+LinkedIn 캠페인:
- 이메일: 발송 X명, 오픈 Y명 (오픈율) | LinkedIn: 초대 X명, 수락 Y명 (수락율) | 답장 Z명

비율 계산 시 분모가 0이면 해당 비율은 표시하지 않는다.

캠페인 유형 분류 기준: 캠페인 이름에 'LinkedIn'만 포함 → LinkedIn 전용, 'Email'만 포함 → 이메일 전용, 둘 다 또는 둘 다 아님 → 혼합.

하단에 주석 추가: `※ 이메일은 발송→오픈→답장, LinkedIn은 초대→수락→답장 퍼널.`

---

### 섹션 2: 캠페인별 성과

`campaigns` 데이터로 archived = false인 캠페인 전체를 출력한다 (draft 포함).

*상태 분류 및 표기:*
- DB status를 한글로 변환: running → 진행중, draft → 초안, paused → 일시정지, ended → 종료
- 단, 이름에 "Phase"가 포함된 캠페인(예: Phase 1, Phase 2, Phase 3)은 DB status와 무관하게 *종료*로 표기한다. 이 캠페인들은 이미 완료된 배치 단위 아웃리치이므로 실질적으로 종료된 캠페인으로 취급한다.

*정렬 순서:*
- 그룹 순서: 진행중 → 초안 → 일시정지 → 종료
- 동일 그룹 내: total_leads 많은 순 (단, 종료 그룹 내 Phase 캠페인은 Phase 번호 오름차순)
- 각 상태 그룹 앞에 `*[진행중]*`, `*[초안]*`, `*[일시정지]*`, `*[종료]*` 헤더를 붙인다.

각 캠페인은 아래 형식으로 *한 줄 요약* + *액션 코멘트*로 출력한다:

```
*{캠페인명}* | {채널 유형}
```

채널 유형별 지표 표시:

*LinkedIn 전용 캠페인:*
```
등록 {total_leads}명 | 수락 {li_accepted} ({li_accepted/li_invite_sent}%) | 답장 {replied} (수락 후 {replied/li_accepted}%) | 실패 {failed} ({failed/li_invite_sent}%)
```

*이메일 전용 캠페인:*
```
등록 {total_leads}명 | 오픈 {message_opened} ({message_opened/message_sent}%) | 답장 {replied} ({replied/message_sent}%) | 바운스 {bounced} ({bounced/message_sent}%)
```

*혼합 캠페인:*
```
등록 {total_leads}명 | 이메일 오픈 {message_opened} ({message_opened/message_sent}%) | LI 수락 {li_accepted} ({li_accepted/li_invite_sent}%) | 답장 {replied} | 실패 {failed}
```

비율 계산 시 분모가 0이면 해당 비율은 표시하지 않는다.
total_leads가 0인 draft 캠페인은 메시지 생성 완료 수치만 표시한다.
messages_generated > total_leads인 경우, 미등록 수를 명시한다.

각 캠페인 아래에 `→`로 시작하는 *액션 코멘트*를 반드시 1줄 추가한다. 데이터에서 도출되는 해당 캠페인의 가장 중요한 관찰 또는 필요 조치를 적는다.

---

### 섹션 3: 인사이트

아래 5개 항목을 데이터에서 계산하여 서술한다. 각 항목은 *현황 서술*에서 끝내지 말고 *구체적 권장 액션*까지 포함한다.

1. *이메일 vs LinkedIn — 채널 역할 재정의*
   - 이메일 전용 캠페인 합산 답장율 vs LinkedIn 전용 캠페인 답장율 비교
   - 이메일 오픈율이 높은데 답장율이 0%라면: CTA 개선 방향 또는 채널 역할 재정의 제안
   - 구체적 CTA 변경 예시를 포함 (예: "관심 있으시면 답장" → "15분 통화 가능한 시간 2개 제안")

2. *LinkedIn 수락 후 답장 전환율*
   - replied / li_accepted 를 캠페인별로 비교
   - 캠페인 간 편차가 크면 원인 가설 제시 (시퀀스 구성 차이, 타겟 풀 차이 등)

3. *SendFailed 비율과 패턴*
   - 캠페인별 실패율 비교
   - 실패 리드의 소속(빅클럽, 대학, 소규모 클럽 등) 패턴 분석
   - 실패 리드를 이메일 캠페인으로 전환 가능한지 제안

4. *이메일 바운스율*
   - 업계 평균(2~5%) 대비 비교
   - 발송 전 이메일 검증 도구 적용 등 구체적 개선 방안 제시

5. *지역별 반응 분포*
   - 국가/지역별 수락/답장 패턴 (EMEA, APAC, Americas 등)
   - 반응 좋은 지역과 나쁜 지역 식별, 다음 배치 타겟 풀 구성에 대한 제안

---

### 섹션 4: 수동 액션 필요 파이프라인

**레이어 1 — 정의된 체크리스트 (항상 확인)**

`leads`와 `notLaunched` 데이터를 바탕으로 아래 기준에 따라 리드를 분류한다.

1. **답장 온 리드 — 수동 대응 필요**
   - `state IN ('emailsReplied', 'linkedinReplied')`인 모든 리드
   - 캠페인 상태 무관 (running이어도 답장은 수동 대응 필요)
   - *담당자(assignee)별로 그룹화*하여 출력한다. 담당자를 캠페인 소유자로 판단한다 (캠페인명에 이름 포함 시 해당 인물, Phase 1~3 등 공유 캠페인은 해당 리드의 assignee 필드 사용).
   - 각 리드는 아래 형식으로 출력:
     ```
     - *{이름}* | {소속}, {국가} — {reply_count}회 답장, {경과일}일 경과
     ```
   - `reply_count >= 3`이면 `[긴급]` 태그 추가
   - `first_reply_at` 기준 경과일 계산, 경과일 오래된 순으로 정렬
   - 각 담당자 그룹 아래에 `→`로 액션 가이드 추가 (예: "LinkedIn DM 확인 후 대화 이어갈 것. 14일 이상 경과 리드는 지연 사과 포함하여 재접근.")

2. **수락됐는데 후속 없음 (캠페인 정지/종료)**
   - `campaign_status IN ('paused', 'ended') AND state = 'linkedinInviteAccepted'`
   - 캠페인별로 묶어서 리드 나열
   - `last_activity`가 'linkedinInviteAccepted'면 "첫 메시지 미발송", 그 외면 "후속 메시지 없음"으로 구분
   - 각 그룹 아래에 `→`로 액션 가이드 추가 (캠페인 재개 또는 수동 DM 중 택 1 제안)

3. **발송 실패**
   - `state IN ('linkedinSendFailed', 'emailsBounced', 'emailsFailed')`
   - state별 + 캠페인별로 묶어서 표시
   - `→`로 후속 액션 제안 (Lemlist 제거 후 다른 채널로 전환 등)

4. **메시지 생성됐으나 Lemlist 미등록**
   - `notLaunched` 목록을 assignee별로 그룹화하여 출력
   - `→ /sdr:campaign_assign 실행하여 각 담당자 캠페인에 등록.`

제외: `campaign_status = 'running'`이고 위 기준에 해당하지 않는 리드는 자동 시퀀스 진행 중으로 간주해 제외.
포함 리드가 없는 카테고리는 출력에서 생략한다.

**레이어 2 — AI 자유 관찰 (체크리스트 외 눈에 띄는 것)**

레이어 1 체크리스트와 별개로, `leads` 데이터 전체를 보고 수동 개입이 필요해 보이지만 정해진 규칙에 잡히지 않는 것을 자유롭게 추가한다.
관찰 사항이 있으면 *현황*과 함께 *구체적 권장 액션*까지 포함한다.

예시 (고정 항목 아님 — 해당되는 경우에만 포함):
- 복수 답장 리드(reply_count > 1)의 장기 방치 시 관계 회복 난이도 경고 + 재접근 메시지 톤 제안
- 오픈율 대비 답장율 갭이 큰 캠페인의 CTA 개선 방향
- 캠페인 간 수락 후 전환율 편차의 원인 가설
- 마지막 활동으로부터 경과 시간이 유독 긴 리드
- messages_generated > total_leads인 캠페인의 미등록 리드 campaign_assign 실행 알림

레이어 2에 해당하는 항목이 없으면 생략한다.

---

## Step 3: 리뷰 및 Slack 발송

### 3-1. 리뷰 루프

리포트 출력 후 아래 질문으로 시작한다:

> "보완할 내용이 있으신가요?"

- 보완 사항이 있으면 수정 적용 후 다시 묻는다: "더 보완할 내용이 있으신가요?"
- 없으면 ("없어요", "괜찮아요", "오케이" 등) → 3-2로 진행한다.
- 수정은 횟수 제한 없이 반복한다.

### 3-2. Slack 발송

.env에서 아래 두 값을 읽는다:

```bash
SLACK_BOT_TOKEN=$(grep -E '^SLACK_BOT_TOKEN=' .env | cut -d'=' -f2 | tr -d '"')
SLACK_SDR_REPORT_CHANNEL=$(grep -E '^SLACK_SDR_REPORT_CHANNEL=' .env | cut -d'=' -f2 | tr -d '"')
```

`SLACK_SDR_REPORT_CHANNEL`이 비어 있으면:
> "`.env`의 `SLACK_SDR_REPORT_CHANNEL`이 비어 있습니다. 채널 ID를 입력해주세요."
입력받은 값으로 발송한다.

채널이 확정되면 curl로 발송한다:

```bash
curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{
    \"channel\": \"$SLACK_SDR_REPORT_CHANNEL\",
    \"text\": \"{리포트 전문 — Slack mrkdwn 형식}\",
    \"mrkdwn\": true
  }"
```

응답의 `ok` 필드가 `true`면 발송 성공을 알린다. `false`면 `error` 필드를 사용자에게 전달한다.
