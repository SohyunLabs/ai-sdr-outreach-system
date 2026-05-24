# /sdr:generate — Message Generation + Save to Neon DB

Generate personalized outreach messages for confirmed leads and save them to Neon messages table.

## Step 1: Confirm target leads

If called after `/sdr:select`, use the confirmed record IDs from that session.
If called standalone, ask: "어떤 컨택의 메시지를 생성할까요? 이름 또는 Airtable record ID를 알려주세요."

## Step 1.5: Assignee 지정

이전 `/sdr:select` 컨텍스트에 assignee가 있으면:

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

확정된 assignee는 --assignee 인수로 스크립트에 전달되며 Neon messages 테이블에 저장된다.

## Step 2: Run generate_messages.py

확정된 record ID들과 assignee를 인수로 넘겨 스크립트를 실행한다:

프로젝트 루트(이 CLAUDE.md가 위치한 디렉토리)에서 실행한다:

```bash
python generate_messages.py --assignee "Sales Manager A" recID1 recID2 ...
```

스크립트가 Airtable fetch, Claude API 호출, Neon 저장, AI Email Creation 마킹을 모두 처리한다.
생성된 메시지에는 채널별 sign-off가 자동으로 추가된다:
- Email body: "Warm regards,\n\n{assignee}"
- LinkedIn body (M1_LI, M2_LI, M3_LI, M5, M6_LI): "Best,\n\n{assignee}"
- M4 (LinkedIn ConnReq): sign-off 없음

## Step 3: Confirm completion

스크립트 출력에서 결과를 파싱해 보고한다:

```
완료. [N]명 메시지 생성 및 Neon 저장 완료. (Assignee: {assignee})
- [Name 1] — Neon message ID: uuid-xxx
- [Name 2] — Neon message ID: uuid-xxx

Lemlist 캠페인 할당을 진행하려면 `/sdr:campaign_assign`을 실행하세요.
(캠페인 ID를 바로 지정하려면 `/sdr:campaign_assign cam_xxx` 형식으로 실행)
```

생성된 Message_DB record ID 목록을 컨텍스트에 보존한다.
`/sdr:campaign_assign` 실행 시 이 record ID 목록이 자동으로 인계된다.

**실행 후 반드시 확인:**
- 스크립트 출력에 `Error`, `Exception`, traceback, `failed` 등이 포함된 경우 → 즉시 중단
- 출력에서 성공한 레코드가 0건인 경우 → 즉시 중단
- 중단 시: "오류: 메시지 생성 실패 — [스크립트 출력 원문]. 진행을 중단합니다." 출력 후 Step 3으로 넘어가지 않는다.
