# /sdr:campaign_assign — Campaign Assignment

이전 `/sdr:generate` 세션에서 생성된 message ID 목록을 Neon DB에 캠페인 정보와 함께 저장한다.
**Lemlist API 호출 없음 — 실제 Lemlist 추가는 sdr-dashboard에서 처리한다.**

## Step 1: 대상 레코드 확인

이전 `/sdr:generate` 세션에서 저장된 Neon messages ID 목록을 사용한다.
없으면 사용자에게 묻는다: "어떤 레코드를 할당할까요? Neon messages ID를 알려주세요."

## Step 2: 캠페인 선택

`$ARGUMENTS`로 캠페인 ID가 직접 전달된 경우 (`/sdr:campaign_assign cam_xxx`) 조회 없이 바로 사용한다.

전달되지 않은 경우, Bash로 사용 가능한 캠페인 목록을 조회한다:

```bash
LEMLIST_API_KEY=$(grep LEMLIST_API_KEY .env | cut -d= -f2)
curl -s -u ":$LEMLIST_API_KEY" "https://api.lemlist.com/api/campaigns"
```

응답에서 다음 형식으로 목록을 출력한다:

```
사용 가능한 Lemlist 캠페인:

| # | 캠페인명 | 상태 | ID |
|---|---------|------|-----|
| 1 | AI SDR Outreach_Phase 1_only_Email_March 27 | draft | cam_xxx |
| 2 | ... | ... | ... |

어떤 캠페인에 할당할까요? 번호 또는 캠페인 ID를 입력하세요.
```

**실행 후 반드시 확인:**
- curl 응답이 JSON 배열이 아니거나 `error` 키를 포함한 경우 → 즉시 중단
- 응답이 빈 배열 `[]`인 경우 → 즉시 중단
- 중단 시: "오류: Lemlist 캠페인 목록 조회 실패 — [응답 내용]. 진행을 중단합니다." 출력 후 다음 스텝으로 넘어가지 않는다.

사용자가 선택하면 해당 캠페인 ID와 캠페인명(`campaign_name`)을 확정한다.

## Step 2.5: Assignee 지정

이전 `/sdr:select` 또는 `/sdr:generate` 컨텍스트에 assignee가 있으면:

```
Assignee: {assignee} — 맞나요? (Enter로 확인, 변경 시 이름 입력)
```

컨텍스트에 없으면 (단독 실행):

```
Assignee를 선택하세요:
1) Sales Manager A
2) Sales Manager B
3) Sales Manager C
```

확정된 assignee는 이후 Neon contacts 테이블 UPDATE에 사용된다.

## Step 3: Neon에서 데이터 fetch

Python으로 Neon에서 messages JOIN contacts 조회:

```python
import asyncio, asyncpg

DB_URL = open('.env').read()
DB_URL = dict(line.split('=', 1) for line in DB_URL.strip().splitlines() if '=' in line and not line.startswith('#'))['DATABASE_URL_UNPOOLED']

msg_ids = [...]  # Step 1에서 확정된 ID 목록
assignee = "Sales Manager A"  # Step 2.5에서 확정된 값

async def fetch_leads():
    conn = await asyncpg.connect(DB_URL)
    placeholders = ', '.join(f'${i+1}' for i in range(len(msg_ids)))
    rows = await conn.fetch(f"""
        SELECT
            m.id          AS message_id,
            m.contact_id,
            m.m1_subject, m.m1_body_email, m.m1_body_li,
            m.m2_subject, m.m2_body_email, m.m2_body_li,
            m.m3_subject, m.m3_body_email, m.m3_body_li,
            m.m4_li_conn_req_body, m.m5_li_chat_body,
            m.m6_subject, m.m6_body_email, m.m6_body_li,
            c.email, c.name, c.linkedin_url, c.country, c.company, c.role
        FROM messages m
        JOIN contacts c ON m.contact_id = c.airtable_id
        WHERE m.id IN ({placeholders})
    """, *msg_ids)
    # sequence_type 판단: 캠페인명에 'linkedin' 포함 여부로 결정
    sequence_type = 'linkedin' if 'linkedin' in campaign_name.lower() else 'email'

    # assignee를 contacts에 업데이트
    await conn.executemany(
        "UPDATE contacts SET assignee = $1 WHERE airtable_id = $2",
        [(assignee, row['contact_id']) for row in rows]
    )
    # messages에 campaign_id, sequence_type 기록
    await conn.executemany(
        "UPDATE messages SET campaign_id = $1, sequence_type = $2 WHERE id = $3",
        [(campaign_id, sequence_type, row['message_id']) for row in rows]
    )
    await conn.close()
    return rows

leads = asyncio.run(fetch_leads())
```

**실행 후 반드시 확인:**
- 출력에 traceback 또는 Exception이 포함된 경우 → 즉시 중단
- `leads`가 0건인 경우 → 즉시 중단
- 중단 시: "오류: Neon 데이터 fetch/업데이트 실패 — [원인]. 진행을 중단합니다." 출력 후 Step 4로 넘어가지 않는다.

## Step 4: 완료 보고

```
완료. [N]명 캠페인 [{campaign_id}] 할당 완료. (Assignee: {assignee})

처리된 contacts:
- John Doe (john.doe@example.com)
- ...

sdr-dashboard To Launch 섹션에서 확인 후 개별 Launch하세요.
```
