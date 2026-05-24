# Fitogether AI SDR

Fitogether 잠재 고객 프로필 기반 AI 콜드 아웃리치 메시지 자동 생성 시스템.
Claude Code 스킬(`/sdr:select`, `/sdr:generate`, `/sdr:campaign_assign`)로 운영한다.

---

## 사전 요구사항

- [Claude Code](https://claude.ai/claude-code) CLI 설치
- Python 3.11+
- Node.js 20+
- Airtable, Lemlist, Neon Postgres, Anthropic API 접근 권한

---

## 설치

```bash
# 1. 레포 클론
git clone https://github.com/your-username/ai-sdr-system.git
cd ai-sdr-system

# 2. Python 의존성 설치
pip install -r requirements.txt

# 3. Node.js 의존성 설치 (select 스킬에서 사용)
npm install

# 4. 환경변수 설정
cp .env.example .env
# .env 파일을 열어 실제 값을 입력한다
```

---

## 환경변수 (.env)

```
ANTHROPIC_API_KEY=sk-ant-...
AIRTABLE_API_KEY=pat...
LEMLIST_API_KEY=...
AIRTABLE_BASE_ID=your_base_id
AIRTABLE_CONTACT_DB=your_table_id
DATABASE_URL_UNPOOLED=postgresql://...
```

API 키는 팀 내부 공유 채널에서 확인한다.

---

## Airtable MCP 서버 설정

`/sdr:select` 스킬이 Airtable 데이터를 조회하려면 Airtable MCP 서버가 필요하다.

Claude Code 설정 파일(`~/.claude/settings.json`)에 아래를 추가한다:

```json
{
  "mcpServers": {
    "airtable": {
      "command": "npx",
      "args": ["-y", "@airtable/mcp-server"],
      "env": {
        "AIRTABLE_API_KEY": "본인의 Airtable Personal Access Token"
      }
    }
  }
}
```

또는 Claude Code 데스크탑 앱 Settings > Integrations에서 Airtable을 연결한다.

---

## 사용법

프로젝트 디렉토리에서 Claude Code를 실행한다:

```bash
claude
```

### 1단계: 리드 선택

```
/sdr:select
```

Airtable Contact_DB에서 상위 20명의 리드를 추천한다. 활성 캠페인 참여자는 자동 제외.

### 2단계: 메시지 생성

```
/sdr:generate
```

확정된 리드에 대해 6종의 맞춤 아웃리치 메시지를 생성하고 Neon DB에 저장한다.

### 3단계: 캠페인 할당

```
/sdr:campaign_assign
```

또는 캠페인 ID를 직접 지정:

```
/sdr:campaign_assign cam_xxx
```

생성된 메시지를 Lemlist 캠페인에 할당한다. 발송은 Lemlist에서 직접 활성화해야 한다.

---

## 프로젝트 구조

```
AI_SDR/
 ├── .claude/commands/sdr/     # Claude Code 스킬 정의
 │   ├── select.md             # /sdr:select
 │   ├── generate.md           # /sdr:generate
 │   └── campaign_assign.md    # /sdr:campaign_assign
 ├── generate_messages.py      # 메시지 생성 메인 스크립트
 ├── knowledge/
 │   └── fitogether_sdr_kb.md  # Fitogether 지식허브 (SDR 특화)
 ├── prompts/
 │   └── system_prompt.md      # Claude API 시스템 프롬프트
 ├── requirements.txt          # Python 의존성
 ├── package.json              # Node.js 의존성
 └── CLAUDE.md                 # Claude Code 프로젝트 설정
```
