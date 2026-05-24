import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateLeadInfo, updateLeadVariables, updateLeadState } from "@/lib/lemlist";

const DB_TO_LEMLIST: Record<string, string> = {
  m1Subject: "m1InitialSubject",
  m1BodyEmail: "m1InitialBody",
  m1BodyLi: "m1InitialBody",
  m2Subject: "m2FU1EmailOpenSubject",
  m2BodyEmail: "m2FU1EmailOpenBody",
  m2BodyLi: "m2FU1EmailOpenBody",
  m3Subject: "m3FU1EmailCloseSubject",
  m3BodyEmail: "m3FU1EmailCloseBody",
  m3BodyLi: "m3FU1EmailCloseBody",
  m4LiConnReq: "m4LIConnReqBody",
  m5LiChat: "m5LIChatBody",
  m6Subject: "m6FinalSubject",
  m6BodyEmail: "m6FinalBody",
  m6BodyLi: "m6FinalBody",
};

// 이메일 body 필드: \n → <br> 변환 필요 (HTML 이메일 렌더링)
// LinkedIn body 필드: \n 그대로 유지 (순수 텍스트)
const EMAIL_BODY_KEYS = new Set(["m1BodyEmail", "m2BodyEmail", "m3BodyEmail", "m6BodyEmail"]);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const lead = await prisma.campaignLead.findUnique({
    where: { id },
    include: { contact: { include: { messages: true } } },
  });

  if (!lead) {
    return NextResponse.json({ error: "리드를 찾을 수 없음" }, { status: 404 });
  }
  if (!lead.contact) {
    return NextResponse.json({ error: "연결된 컨택트 없음" }, { status: 400 });
  }

  const contact = lead.contact;
  const errors: string[] = [];

  // Lemlist REST API: lea_xxx ID 사용 (email은 더미 응답 반환)
  const lemlistIdentifier = lead.lemlistLeadId;
  if (!lemlistIdentifier) {
    return NextResponse.json({ error: "Lemlist lead ID가 없음" }, { status: 400 });
  }

  // 1. 배경 정보 sync
  const nameParts = (contact.name ?? "").trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");
  try {
    await updateLeadInfo(lead.campaignId, lemlistIdentifier, {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      companyName: contact.company ?? undefined,
      jobTitle: contact.role ?? undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
      return NextResponse.json(
        { error: "이 리드는 Lemlist에 존재하지 않습니다. Campaign Analysis에서 Data Sync를 실행해 주세요." },
        { status: 404 }
      );
    }
    errors.push(`배경 정보: ${msg}`);
  }

  // 2. 메시지 시퀀스 sync
  const msg = contact.messages[0];
  if (msg) {
    const lemlistVars: Record<string, string> = {};
    // 1패스: LinkedIn body 포함 나머지 필드
    for (const [dbKey, lemlistKey] of Object.entries(DB_TO_LEMLIST)) {
      if (EMAIL_BODY_KEYS.has(dbKey)) continue;
      const value = (msg as Record<string, unknown>)[dbKey];
      if (typeof value === "string" && value.trim() !== "") {
        lemlistVars[lemlistKey] = value;
      }
    }
    // 2패스: 이메일 body 필드 — 같은 키를 쓰는 LinkedIn body를 덮어씀 + \n→<br>
    for (const [dbKey, lemlistKey] of Object.entries(DB_TO_LEMLIST)) {
      if (!EMAIL_BODY_KEYS.has(dbKey)) continue;
      const value = (msg as Record<string, unknown>)[dbKey];
      if (typeof value === "string" && value.trim() !== "") {
        lemlistVars[lemlistKey] = value.replace(/\n/g, "<br>");
      }
    }
    if (Object.keys(lemlistVars).length > 0) {
      try {
        await updateLeadVariables(lemlistIdentifier, lemlistVars);
      } catch (e) {
        errors.push(`메시지 시퀀스: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // 3. 캠페인 상태 sync
  if (lead.state) {
    try {
      await updateLeadState(lead.campaignId, lemlistIdentifier, lead.state);
    } catch (e) {
      errors.push(`캠페인 상태: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 동기화 완료 → dirty 초기화
  if (errors.length === 0) {
    await prisma.campaignLead.update({
      where: { id },
      data: { isLemlistDirty: false },
    });
  }

  return NextResponse.json({
    ok: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  });
}
