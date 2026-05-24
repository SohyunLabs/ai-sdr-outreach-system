# /sdr:select — AI Lead Selection

You are helping a Fitogether sales rep select the best leads to reach out to today.

## Step 0: Assignee & 지역 확인

Airtable 조회 전에 담당자와 지역을 **순서대로 따로** 질문한다.

**담당자 질문:**
```
담당자(Assignee)를 선택하세요:
1) Sales Manager A
2) Sales Manager B
3) Sales Manager C
```

사용자가 응답하면 **assignee**로 저장한다. 그 다음 지역 질문으로 넘어간다.

**지역 질문:**
```
타겟 지역을 선택하세요:
1) Korea
2) Japan
3) APAC
4) EMEA
5) NAM
```

사용자가 응답하면 **target_region**으로 저장한다.
이후 모든 단계에서 두 값을 참조한다.

**지역 판단 기준 (Experiences의 location 필드 기반):**

| 지역 | 포함 국가/지역 키워드 |
|------|----------------------|
| Korea | Korea, South Korea |
| Japan | Japan |
| APAC | Japan, Korea, China, Australia, New Zealand, Thailand, Indonesia, Malaysia, Philippines, India, Singapore, Taiwan, Hong Kong, Vietnam |
| EMEA | United Kingdom, England, Scotland, Wales, Ireland, France, Germany, Spain, Italy, Portugal, Netherlands, Belgium, Switzerland, Austria, Denmark, Sweden, Norway, Finland, Poland, Czech, Hungary, Romania, Bulgaria, Croatia, Serbia, Greece, Turkey, Ukraine, Latvia, Estonia, Lithuania, Georgia, Armenia, Azerbaijan, Cyprus, Malta, Luxembourg, Morocco, Tunisia, Egypt, Saudi Arabia, UAE, Qatar, Kuwait, Israel, Jordan, Nigeria, Ghana, South Africa, Tanzania, Mali, Senegal |
| NAM | United States, USA, Canada, Mexico, New York, Florida, California, Texas, Boston, Chicago |

- location 정보가 없으면 회사명·국가 컨텍스트로 추론한다.
- 판단 불가 시 해당 후보는 포함 방향으로 처리한다.

## Step 1: Load candidates from Airtable

MCP tool 대신 Python 스크립트로 전체 레코드를 한 번에 fetch한다 (페이지 분할 tool call 오버헤드 제거):

```python
import requests, json, re

env = {}
for line in open('.env'):
    line = line.strip()
    m = re.match(r'^([^#=\s]+)\s*=\s*"?([^"]*)"?$', line)
    if m: env[m.group(1)] = m.group(2).strip()

API_KEY = env['AIRTABLE_API_KEY']
BASE_ID = env['AIRTABLE_BASE_ID']
TABLE_ID = env['AIRTABLE_CONTACT_DB']
headers = {'Authorization': f'Bearer {API_KEY}'}

all_records = []
offset = None
while True:
    params = {'view': 'for_claude', 'pageSize': 100}
    if offset:
        params['offset'] = offset
    r = requests.get(f'https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}',
                     headers=headers, params=params)
    data = r.json()
    all_records.extend(data.get('records', []))
    offset = data.get('offset')
    if not offset:
        break

print(json.dumps({'count': len(all_records), 'records': all_records}, ensure_ascii=False))
```

출력된 JSON에서 `records` 배열을 이후 단계의 후보 목록으로 사용한다.
`AI Email Creation` 필터 제거 — 중복/재진행 판단은 Step 1.5 DB 조회로 일원화한다.

**실행 후 반드시 확인:**
- 출력에 traceback 또는 `error`/`Error` 키가 포함된 경우 → 즉시 중단
- `count`가 0인 경우 → 즉시 중단
- 중단 시: "오류: Airtable Contact_DB 조회 실패 — [원인]. 진행을 중단합니다." 출력 후 다음 스텝으로 넘어가지 않는다.

## Step 1.3: Account 상태 분류 + Neon 저장 + 제외 목록 생성

아래 Python 스크립트를 프로젝트 루트에서 Bash로 실행한다.
Account 전체를 5단계로 분류해 Neon DB에 upsert하고, 제외 대상 클럽 목록을 출력한다.

```python
import requests, json, re, asyncio, asyncpg

async def main():
    env = {}
    for line in open('.env'):
        line = line.strip()
        m = re.match(r'^([^#=\s]+)\s*=\s*"?([^"]*)"?$', line)
        if m: env[m.group(1)] = m.group(2).strip()

    API_KEY = env['AIRTABLE_API_KEY']
    BASE_ID = env['AIRTABLE_BASE_ID']
    TABLE_ID = env['AIRTABLE_ACCOUNT_DB']
    headers = {'Authorization': f'Bearer {API_KEY}'}

    all_records = []
    offset = None
    while True:
        params = {
            'fields[]': ['Club Name', 'Filter_Active', 'Contract', 'Opportunity',
                         'Open Opportunity', 'Account_ID', 'Country', 'Region'],
            'pageSize': 100
        }
        if offset:
            params['offset'] = offset
        r = requests.get(f'https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}',
                         headers=headers, params=params)
        data = r.json()
        all_records.extend(data.get('records', []))
        offset = data.get('offset')
        if not offset:
            break

    classified = []
    for rec in all_records:
        f = rec.get('fields', {})
        filter_active   = f.get('Filter_Active', 0)
        has_contract    = bool(f.get('Contract'))         # linked records
        has_opportunity = bool(f.get('Opportunity'))      # linked records
        has_open_opp    = bool(f.get('Open Opportunity')) # linked records

        if filter_active >= 1:
            status = 'client'
        elif has_open_opp:
            status = 'negotiating'
        elif has_contract:
            status = 'churned'
        elif has_opportunity:
            status = 'lost_deal'
        else:
            status = 'no_comm'

        classified.append({
            'airtable_account_id': rec['id'],
            'club_name': f.get('Club Name', '').strip(),
            'account_id': f.get('Account_ID', ''),
            'country': f.get('Country', ''),
            'region': f.get('Region', ''),
            'filter_active': filter_active,
            'lead_status': status
        })

    conn = await asyncpg.connect(env['DATABASE_URL_UNPOOLED'])
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS accounts (
            airtable_account_id TEXT PRIMARY KEY,
            club_name TEXT NOT NULL,
            account_id TEXT,
            country TEXT,
            region TEXT,
            filter_active INTEGER DEFAULT 0,
            lead_status TEXT NOT NULL,
            synced_at TIMESTAMP DEFAULT NOW()
        )
    """)
    await conn.executemany("""
        INSERT INTO accounts (airtable_account_id, club_name, account_id, country, region, filter_active, lead_status, synced_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (airtable_account_id) DO UPDATE SET
            club_name = EXCLUDED.club_name,
            filter_active = EXCLUDED.filter_active,
            lead_status = EXCLUDED.lead_status,
            synced_at = NOW()
    """, [(r['airtable_account_id'], r['club_name'], r['account_id'],
           r['country'], r['region'], r['filter_active'], r['lead_status'])
          for r in classified])
    await conn.close()

    stats = {s: sum(1 for r in classified if r['lead_status'] == s)
             for s in ['client', 'negotiating', 'churned', 'lost_deal', 'no_comm']}
    exclude = [{'club_name': r['club_name'], 'status': r['lead_status'], 'country': r['country']}
               for r in classified if r['lead_status'] in ('client', 'negotiating')]
    print(json.dumps({'stats': stats, 'exclude_clubs': exclude}, ensure_ascii=False))

asyncio.run(main())
```

**실행 후 반드시 확인:**
- 출력에 traceback 또는 Exception이 포함된 경우 → 즉시 중단
- 중단 시: "오류: Account 상태 분류 실패 — [원인]. client/negotiating 클럽 제외 없이 진행할 수 없습니다." 출력 후 다음 스텝으로 넘어가지 않는다.

**리드 상태 분류 기준 (우선순위 순):**

| 상태 | 조건 |
|------|------|
| `client` | `Filter_Active >= 1` (활성 계약 존재) |
| `negotiating` | `Open Opportunity` linked record 존재 (협상 진행 중) |
| `churned` | `Contract` linked record 존재 + Open Opportunity 없음 |
| `lost_deal` | `Opportunity` linked record 존재 + Contract/Open Opp 없음 |
| `no_comm` | 위 어느 것도 없음 |

**Contact_DB 후보와 매칭 — Claude가 의미적으로 판단:**

`exclude_clubs` 목록(client + negotiating 클럽명 + 국가)을 확인한 뒤,
Step 1에서 가져온 각 후보의 `Current Company`가 exclude_clubs의 어느 클럽과 동일한 조직인지 **의미적으로** 판단한다.

판단 기준:
- FK / FC / NK / SC / SK 등 클럽 유형 접두어 혼용은 동일 클럽으로 간주
- 철자 변형 (Varaždin / Varazdin), 특수문자 차이는 동일 클럽으로 간주
- 언어 변형 (Bursaspor Kulübü / Bursaspor)은 동일 클럽으로 간주
- 애매한 경우 **제외 방향**으로 판단 (현재 고객/협상 중인 고객에게 콜드 메일 방지)

매칭된 contact는 후보에서 즉시 제외하고 알린다:
> "N명이 제외되었습니다 — [이름 (회사명): client/negotiating] ..."

## Step 1.5: SDR Dashboard DB로 캠페인 이력 확인

SDR Dashboard의 Neon DB를 조회해 후보를 세 가지로 분류한다.

프로젝트 루트에서 아래 Python 코드를 Bash로 실행한다. `AIRTABLE_IDS`에 Step 1에서 수집한 airtable record ID 전체를 넣는다:

```python
import asyncio, asyncpg, re, json

async def main():
    env = {}
    for line in open('.env'):
        line = line.strip()
        m = re.match(r'^([^#=\s]+)\s*=\s*"?([^"]*)"?$', line)
        if m: env[m.group(1)] = m.group(2).strip()

    AIRTABLE_IDS = [
        # 여기에 airtable record ID 목록 삽입
    ]

    conn = await asyncpg.connect(env['DATABASE_URL_UNPOOLED'])
    rows = await conn.fetch("""
        SELECT
            contact_id AS airtable_contact_id,
            MAX(has_active) AS has_active_campaign,
            STRING_AGG(DISTINCT campaign_name, ' / ') AS campaign_names,
            MAX(last_state) AS last_state
        FROM (
            -- campaign_assign 완료 (messages.campaign_id 세팅됨, 미런치 포함)
            SELECT
                m.contact_id,
                CASE WHEN c.archived = false THEN 1 ELSE 0 END AS has_active,
                c.name AS campaign_name,
                NULL AS last_state
            FROM messages m
            JOIN campaigns c ON c.campaign_id = m.campaign_id
            WHERE m.contact_id = ANY($1)
              AND m.campaign_id IS NOT NULL

            UNION ALL

            -- Lemlist 런치됨 (campaign_leads 등록)
            SELECT
                cl.airtable_contact_id,
                CASE WHEN c.archived = false THEN 1 ELSE 0 END AS has_active,
                c.name AS campaign_name,
                cl.state AS last_state
            FROM campaign_leads cl
            JOIN campaigns c ON c.campaign_id = cl.campaign_id
            WHERE cl.airtable_contact_id = ANY($1)

            UNION ALL

            -- generate만 된 contact (campaign_id IS NULL, campaign_assign 미완료)
            SELECT
                m.contact_id,
                1 AS has_active,
                '(미할당)' AS campaign_name,
                NULL AS last_state
            FROM messages m
            WHERE m.contact_id = ANY($1)
              AND m.campaign_id IS NULL
        ) sub
        GROUP BY contact_id
    """, AIRTABLE_IDS)
    await conn.close()

    active = [dict(r) for r in rows
              if r['has_active_campaign'] == 1
              and '(미할당)' not in (r['campaign_names'] or '')]
    unassigned = [dict(r) for r in rows
                  if r['has_active_campaign'] == 1
                  and '(미할당)' in (r['campaign_names'] or '')]
    reengagement = [dict(r) for r in rows if r['has_active_campaign'] == 0]
    print(json.dumps({'active': active, 'unassigned': unassigned, 'reengagement': reengagement}, default=str))

asyncio.run(main())
```

**실행 후 반드시 확인:**
- 출력에 traceback 또는 Exception이 포함된 경우 → 즉시 중단
- 중단 시: "오류: Neon 캠페인 이력 조회 실패 — [원인]. 활성 캠페인 중복 확인 없이 진행할 수 없습니다." 출력 후 다음 스텝으로 넘어가지 않는다.

결과 처리:
- `active` 목록 = 현재 활성 캠페인(archived=false)에 있는 contact → **후보에서 즉시 제외**
- `unassigned` 목록 = 메시지 생성됐으나 campaign_assign 미완료 → **후보에서 즉시 제외**
- `reengagement` 목록 = 과거 캠페인에 있었지만 모두 archived → **재진행 후보로 플래그**
- DB에 없는 contact = 한 번도 캠페인에 등록된 적 없는 신규 후보 → **그대로 유지**

제외/플래그된 컨택이 있으면 분석 전에 사용자에게 알린다:
> "[N]명이 활성 캠페인에 이미 있어 제외되었습니다: [이름 목록]"
> "[N]명이 메시지 생성 후 미할당 상태로 제외되었습니다: [이름 목록] — /sdr:campaign_assign을 먼저 완료하세요."
> "[N]명이 과거 캠페인 참여 이력이 있습니다 (재진행 후보): [이름 — 캠페인명]"

## Step 2: Analyze each candidate

Step 1.3(client/negotiating 제외)과 Step 1.5(활성 캠페인 제외) 후 남은 후보를 대상으로 분석한다.

**지역 필터 적용:** `target_region`이 Global이 아닌 경우, Step 0에서 정의한 지역 기준에 해당하는 후보만을 대상으로 분석한다. 처음부터 해당 지역 후보 중 상위 20명을 선정한다.

재진행 후보(reengagement 플래그)는 신규 후보와 동일한 기준으로 점수를 매기되, 포함 여부는 AI가 판단한다. 포함 시 Step 3 테이블에 "재진행" 표시를 추가한다.

For each record, evaluate fit for Fitogether outreach based on:

**Strong signals (prioritize):**
- High `AI Score (Profile)` (8-10)
- `AI Recent_Interactions_summary` mentions: GPS tracking, workload monitoring, EPTS, performance data, load management, injury prevention
- `AI Scoring Reason (Profile)` = "Contents Creator" — Fitogether 콘텐츠를 직접 제작한 사람, engagement 가능성 높음
- `Experiences` shows role at professional/semi-professional club or national federation

**Weak signals (deprioritize):**
- `AI Score (Profile)` below 6
- Role is purely academic, recreational, or youth grassroots with no performance tech context
- `Contact Profile` or `Experiences` shows aquatics, para-sport, or non-football focus

## Step 3: Present recommendations

Output a ranked shortlist of **20 leads** in this format:

---
### Recommended leads for today
**Assignee:** {assignee} | **Region:** {target_region}

| # | Name | Company | Score | 구분 | Why |
|---|------|---------|-------|------|-----|
| 1 | ... | ... | 9/10 | 신규 | One-line reason referencing their specific profile signal |
| 2 | ... | ... | ... | 재진행 (March 27 캠페인) | ... |

---

## Step 4: Ask for confirmation

After presenting, ask:

> "위 리스트로 진행할까요? 제외하거나 추가할 컨택이 있으면 알려주세요. 확정되면 `/sdr:generate`로 메시지 생성을 시작합니다."

Store the confirmed record IDs, **assignee**, and **target_region** in your context — they will be needed for `/sdr:generate`.
