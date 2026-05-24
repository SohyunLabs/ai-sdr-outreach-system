"use client";

import { Terminal, ArrowRight, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─── Skill Guide ────────────────────────────────────────────────────────────

interface Step {
  number: number;
  command: string;
  title: string;
  description: string;
  details: string[];
  note?: string;
}

const steps: Step[] = [
  {
    number: 1,
    command: "/sdr:select",
    title: "리드 선택",
    description: "Airtable Contact_DB에서 오늘 연락할 최적의 리드 20명을 선별합니다.",
    details: [
      "Airtable Contact_DB (view: for_claude) 전체 후보 조회",
      "Neon DB campaign_leads 조회로 캠페인 이력 확인 — active(활성 캠페인 참여 중) 리드 즉시 제외, archived 캠페인만 있는 리드는 재진행 후보로 플래그",
      "AI Score, 최근 인터랙션, 직책, 이메일 유무 기반 랭킹",
      "최종 리스트 확인 후 추가/제외 조정 가능",
    ],
    note: "확정된 record ID 목록이 다음 스킬로 자동 인계됩니다.",
  },
  {
    number: 2,
    command: "/sdr:generate",
    title: "메시지 생성",
    description: "확정된 리드별로 채널별 맞춤형 아웃리치 메시지 6종을 생성하고 Neon messages DB에 저장합니다.",
    details: [
      "M1 초기 이메일, M2-M3 이메일 팔로업 (각 100-125 단어)",
      "M4 LinkedIn 연결 요청 (200자 이내 엄수), M5 LinkedIn 채팅",
      "M6 최종 이메일 — 다른 각도 + Exit Statement 포함",
      "Fitogether KB 기반 개인화 — 각 리드의 프로필, 경력, 콘텐츠 반영",
    ],
    note: "생성 완료 후 Neon messages ID 목록이 campaign_assign으로 자동 인계됩니다.",
  },
  {
    number: 3,
    command: "/sdr:campaign_assign",
    title: "캠페인 할당",
    description: "생성된 메시지와 연락처 정보를 Neon DB에 저장하고 캠페인을 배정합니다. Lemlist 실제 추가는 대시보드 Launch 버튼에서 수행합니다.",
    details: [
      "사용 가능한 Lemlist 캠페인 목록 조회 후 선택",
      "Assignee 지정 → Neon contacts.assignee 업데이트",
      "각 리드의 메시지 필드를 Neon DB에 저장 — Lemlist custom variable 형태로 준비",
      "이메일 없는 리드는 건너뜀, 이미 존재하는 리드는 건너뜀",
    ],
    note: "스킬 실행 후 대시보드 Campaign Analysis의 To Launch 섹션에 리드가 표시됩니다. Lemlist Launch 버튼을 눌러야 Lemlist에 실제로 추가됩니다.",
  },
];

function SkillGuideTab() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-base font-semibold">개요</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Claude Code에서 아래 스킬을 순서대로 실행하여 아웃리치 파이프라인을 운영합니다.
          각 스킬은 자동으로 다음 스킬에 필요한 데이터를 인계합니다.
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm">
          {steps.map((step, i) => (
            <div key={step.command} className="flex items-center gap-2">
              <code className="rounded bg-primary/10 px-2 py-1 text-xs font-mono font-semibold text-primary">
                {step.command}
              </code>
              {i < steps.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {steps.map((step) => (
          <div key={step.command} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {step.number}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                  <code className="text-sm font-mono font-semibold">{step.command}</code>
                  <span className="text-sm text-muted-foreground">— {step.title}</span>
                </div>
                <p className="mt-2 text-sm text-foreground">{step.description}</p>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {step.details.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500/70" />
                      {d}
                    </li>
                  ))}
                </ul>
                {step.note && (
                  <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />
                    <p className="text-xs text-muted-foreground">{step.note}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">대시보드 연동 방법</h3>
        <div className="mt-1.5 text-sm text-muted-foreground flex flex-col gap-2">
          <p>
            <code className="font-mono text-xs">/sdr:campaign_assign</code> 실행 후,
            Campaign Analysis 탭의 <strong>To Launch</strong> 섹션에 리드가 표시됩니다.
          </p>
          <ol className="list-decimal list-inside flex flex-col gap-1 pl-1">
            <li>체크박스로 런치할 리드를 선택합니다 (전체 선택 가능)</li>
            <li>
              상단 <strong>Lemlist Launch</strong> 버튼을 클릭합니다 — 선택한 리드가 Lemlist 캠페인에 실제로 추가되고 자동 동기화됩니다
            </li>
            <li>런치된 리드는 <strong>Launched</strong> 섹션으로 이동합니다</li>
          </ol>
          <p>
            이 스킬을 통해 추가된 리드는{" "}
            <code className="font-mono text-xs">airtableContactId</code>가 자동 저장되어
            이름, 회사, 직책 정보가 테이블에 표시됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Analysis ───────────────────────────────────────────────────────

interface GuideSection {
  title: string;
  body: React.ReactNode;
}

function SectionCard({ title, body }: GuideSection) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</div>
    </div>
  );
}

const STATUS_COLOR_ROWS = [
  { color: "bg-blue-500", meaning: "진행중", states: "스캔됨, 검토됨, 이메일 발송·열람, LinkedIn 방문·메시지·초대" },
  { color: "bg-green-500", meaning: "응답/관심", states: "이메일 답장, LinkedIn 수락·답장, 관심" },
  { color: "bg-red-500", meaning: "문제", states: "반송, 발송 실패, 수신 거부, 미관심" },
  { color: "bg-gray-400", meaning: "완료/기타", states: "완료, 일시정지, 스킵, 수동" },
];

function CampaignAnalysisTab() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold">개요</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          선택한 Lemlist 캠페인 하나의 리드 현황을 모니터링합니다.
          상단 요약 카드로 진행 상황을 한눈에 파악하고, 테이블에서 각 리드의 상세 상태를 확인합니다.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard
          title="Lemlist Launch 버튼"
          body={
            <>
              <code className="font-mono text-xs">/sdr:campaign_assign</code> 실행 후 To Launch 섹션에 나타난 리드를 Lemlist 캠페인에 실제로 추가합니다.
              체크박스로 리드를 선택한 뒤 클릭하면 선택된 리드가 일괄 런치되고 자동으로 데이터 동기화가 실행됩니다.
              런치된 리드는 Launched 섹션으로 이동합니다.
            </>
          }
        />

        <SectionCard
          title="Data Sync 버튼"
          body="Lemlist API에서 최신 데이터를 가져와 DB에 저장합니다. 캠페인 상태, 리드 상태, 시퀀스 진행도가 업데이트됩니다. Lemlist에서 직접 상태를 변경한 경우 눌러주세요."
        />

        <SectionCard
          title="요약 카드"
          body={
            <ul className="flex flex-col gap-1 mt-1">
              <li><strong className="text-foreground">진행중</strong> — 현재 시퀀스가 돌아가고 있는 리드 수</li>
              <li><strong className="text-foreground">응답</strong> — 이메일 또는 링크드인으로 답장이 온 리드 수</li>
              <li><strong className="text-foreground">문제</strong> — 반송·발송 실패·수신 거부 리드 수</li>
              <li><strong className="text-foreground">대기</strong> — To Launch 포함, 아직 시퀀스가 시작되지 않은 리드 수</li>
            </ul>
          }
        />

        <SectionCard
          title="상태 컬럼"
          body={
            <>
              <p>Lemlist 캠페인 내 리드의 마지막 액션 상태입니다. Lemlist가 기록한 이벤트 중 가장 최신 값을 보여줍니다.</p>
              <div className="mt-3 rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 text-left font-medium">색상</th>
                      <th className="px-3 py-2 text-left font-medium">그룹</th>
                      <th className="px-3 py-2 text-left font-medium">포함 상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STATUS_COLOR_ROWS.map((row) => (
                      <tr key={row.meaning} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center justify-center rounded-full h-3 w-3 ${row.color}`} />
                        </td>
                        <td className="px-3 py-2 font-medium text-foreground">{row.meaning}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.states}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          }
        />

        <SectionCard
          title="테이블 그룹"
          body={
            <ul className="flex flex-col gap-2 mt-1">
              <li>
                <strong className="text-foreground">Launched</strong> — Lemlist에 실제로 추가되어 시퀀스가 진행 중인 리드.
                클릭하면 리드 상세 페이지로 이동합니다. Lemlist에 수동으로 추가한 리드는 <span className="inline-flex items-center rounded-full bg-purple-500 text-white text-[10px] px-1.5">매칭 실패</span> 배지로 표시되며 클릭이 비활성화됩니다.
              </li>
              <li>
                <strong className="text-foreground">To Launch</strong> — <code className="font-mono text-xs">/sdr:campaign_assign</code> 후 DB에만 저장되고 아직 Lemlist에 추가되지 않은 리드.
                체크박스로 선택 후 Lemlist Launch 버튼으로 런치합니다. 클릭하면 메시지 미리보기 및 단건 Launch 페이지로 이동합니다.
              </li>
            </ul>
          }
        />

        <SectionCard
          title="이름·회사·직책이 표시되는 리드"
          body={
            <>
              <code className="font-mono text-xs">/sdr:campaign_assign</code> 스킬로 추가된 리드만 연락처 정보가 표시됩니다.
              이 스킬이 Airtable Contact ID를 저장하기 때문에, 직접 Lemlist에서 추가한 리드는 이름 없이 이메일만 표시됩니다.
            </>
          }
        />

        <SectionCard
          title="시퀀스"
          body="Lemlist 캠페인에 설정된 전체 스텝 중 현재 몇 번째 단계까지 진행됐는지를 나타냅니다. 예: 2/5 = 5단계짜리 캠페인에서 2번째 스텝 완료."
        />
      </div>
    </div>
  );
}

// ─── Profile Analysis ────────────────────────────────────────────────────────

function ProfileAnalysisTab() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold">개요</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Airtable Contact DB의 모든 연락처를 Lemlist 캠페인 상태와 함께 보여줍니다.
          캠페인에 배정됐든 아니든 모든 연락처가 표시되며, 연락처 단위로 아웃리치 진행 상황을 파악할 수 있습니다.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard
          title="필터"
          body={
            <ul className="flex flex-col gap-1 mt-1">
              <li><strong className="text-foreground">상단 탭</strong> — 전체 / 진행중 / 응답 / 문제 / 기타 / 미배정 그룹 필터</li>
              <li><strong className="text-foreground">캠페인 선택</strong> — 특정 캠페인에 속한 연락처만 필터링</li>
              <li><strong className="text-foreground">AI 점수 최소</strong> — 설정한 점수 이상의 연락처만 표시</li>
              <li><strong className="text-foreground">검색</strong> — 이름, 회사, 직책, 이메일로 검색</li>
            </ul>
          }
        />

        <SectionCard
          title="상태 컬럼"
          body="연락처가 속한 캠페인 중 가장 활성 상태인 캠페인의 현재 상태를 표시합니다. 여러 캠페인에 등록된 경우 진행중(파란색) 캠페인을 우선 선택하고, 없으면 가장 최근 캠페인을 사용합니다."
        />

        <SectionCard
          title="미배정"
          body={
            <>
              아직 어떤 Lemlist 캠페인에도 추가되지 않은 연락처입니다.{" "}
              <code className="font-mono text-xs">/sdr:select</code> →{" "}
              <code className="font-mono text-xs">/sdr:generate</code> →{" "}
              <code className="font-mono text-xs">/sdr:campaign_assign</code> 플로우를 실행하면 배정됩니다.
            </>
          }
        />

        <SectionCard
          title="시퀀스"
          body="해당 연락처의 주요 캠페인에서 전체 스텝 중 현재 몇 번째 단계까지 진행됐는지입니다. 미배정 연락처는 시퀀스 정보가 없어 표시되지 않습니다."
        />

        <SectionCard
          title="클릭 동작"
          body={
            <ul className="flex flex-col gap-1 mt-1">
              <li><strong className="text-foreground">미배정 연락처 클릭</strong> — 연락처 프로필 페이지로 이동 (Airtable 정보, AI 분석)</li>
              <li><strong className="text-foreground">캠페인 배정 연락처 클릭</strong> — 리드 상세 페이지로 이동 (캠페인 시퀀스 전체 보기)</li>
            </ul>
          }
        />

        <div className="flex items-start gap-2 rounded-md bg-muted/50 px-4 py-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
          <p className="text-sm text-muted-foreground">
            Profile Analysis의 Sync는 Campaign Analysis와 동일한 Lemlist 동기화입니다.
            어느 탭에서 Sync를 눌러도 양쪽 데이터가 모두 갱신됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Lead Detail ─────────────────────────────────────────────────────────────

function LeadDetailTab() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold">개요</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Campaign Analysis 또는 Profile Analysis에서 리드를 클릭하면 리드 상세 페이지로 이동합니다.
          Launched 리드와 To Launch 리드에 따라 화면 동작이 다릅니다.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard
          title="Launched 리드 (일반 모드)"
          body={
            <ul className="flex flex-col gap-2 mt-1">
              <li><strong className="text-foreground">Data Sync</strong> — Lemlist에서 최신 상태·시퀀스 데이터를 가져와 DB를 업데이트합니다.</li>
              <li><strong className="text-foreground">메시지 시퀀스 편집</strong> — 우측 상단 편집 버튼으로 메시지 내용을 직접 수정하고 저장할 수 있습니다.</li>
              <li>
                <strong className="text-foreground">미반영 변경사항 배너</strong> — 메시지를 저장하면 상단에 amber 배너가 표시됩니다.
                <ul className="mt-1 flex flex-col gap-1 pl-4">
                  <li><strong className="text-foreground">Apply Changes</strong> — 수정된 메시지를 Lemlist custom variable에 반영합니다.</li>
                  <li><strong className="text-foreground">Discard Changes</strong> — 수정 내용을 버리고 Lemlist 원본 데이터로 복원합니다.</li>
                </ul>
              </li>
            </ul>
          }
        />

        <SectionCard
          title="To Launch 리드 (Pending 모드)"
          body={
            <ul className="flex flex-col gap-2 mt-1">
              <li>Campaign Analysis의 To Launch 섹션에서 리드를 클릭하면 Pending 모드로 열립니다.</li>
              <li><strong className="text-foreground">Lemlist Launch 버튼</strong> — 우측 캠페인 상태 카드에 표시됩니다. 클릭하면 해당 리드를 Lemlist에 추가하고 자동 동기화 후 Launched 상태의 리드 상세 페이지로 이동합니다.</li>
              <li>Pending 모드에서는 미반영 배너·Apply Changes·Discard Changes가 표시되지 않습니다.</li>
            </ul>
          }
        />

        <SectionCard
          title="좌측 패널 — 배경 정보"
          body={
            <ul className="flex flex-col gap-1 mt-1">
              <li>이름, 국가, 회사, 직책, 이메일, LinkedIn URL</li>
              <li>경력 (JSON 파싱 가능 시 구조화 표시, 아니면 텍스트)</li>
              <li>소개 (About)</li>
            </ul>
          }
        />

        <SectionCard
          title="좌측 패널 — AI 분석"
          body="AI 점수 (0-10), 점수 산정 이유, 최근 관심사/인터랙션 요약이 표시됩니다. Airtable에서 AI 분석이 완료된 리드만 데이터가 표시됩니다."
        />

        <SectionCard
          title="좌측 패널 — 활동 기록"
          body="Lemlist에서 기록된 이벤트 이력이 시간순으로 표시됩니다. 이메일 발송·열람·답장, LinkedIn 방문·메시지·수락 등의 활동이 포함됩니다."
        />

        <SectionCard
          title="우측 패널 — 메시지 시퀀스"
          body={
            <ul className="flex flex-col gap-2 mt-1">
              <li>리드에 이메일이 있으면 이메일 시퀀스, 없으면 LinkedIn 시퀀스를 표시합니다.</li>
              <li>이미 발송된 스텝은 왼쪽에 파란 세로선과 <strong className="text-foreground">전송됨</strong> 표시로 구분됩니다.</li>
              <li>이메일 답장 여부에 따라 분기 시퀀스가 활성/비활성으로 표시됩니다.</li>
              <li>각 스텝 우측 화살표를 클릭해 본문을 펼쳐볼 수 있습니다.</li>
            </ul>
          }
        />
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Guide</h2>
      </div>

      <Tabs defaultValue="skill-guide">
        <TabsList className="mb-6">
          <TabsTrigger value="skill-guide">Skill Guide</TabsTrigger>
          <TabsTrigger value="campaign-analysis">Campaign Analysis</TabsTrigger>
          <TabsTrigger value="profile-analysis">Profile Analysis</TabsTrigger>
          <TabsTrigger value="lead-detail">Profile Details</TabsTrigger>
        </TabsList>

        <TabsContent value="skill-guide">
          <SkillGuideTab />
        </TabsContent>
        <TabsContent value="campaign-analysis">
          <CampaignAnalysisTab />
        </TabsContent>
        <TabsContent value="profile-analysis">
          <ProfileAnalysisTab />
        </TabsContent>
        <TabsContent value="lead-detail">
          <LeadDetailTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
