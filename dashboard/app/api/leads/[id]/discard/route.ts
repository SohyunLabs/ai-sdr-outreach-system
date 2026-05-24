import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchLeadFromCampaign } from "@/lib/lemlist";

const LEMLIST_TO_DB: Record<string, string[]> = {
  m1InitialSubject:      ["m1Subject"],
  m1InitialBody:         ["m1BodyEmail", "m1BodyLi"],
  m2FU1EmailOpenSubject: ["m2Subject"],
  m2FU1EmailOpenBody:    ["m2BodyEmail", "m2BodyLi"],
  m3FU1EmailCloseSubject:["m3Subject"],
  m3FU1EmailCloseBody:   ["m3BodyEmail", "m3BodyLi"],
  m4LIConnReqBody:       ["m4LiConnReq"],
  m5LIChatBody:          ["m5LiChat"],
  m6FinalSubject:        ["m6Subject"],
  m6FinalBody:           ["m6BodyEmail", "m6BodyLi"],
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const lead = await prisma.campaignLead.findUnique({
    where: { id },
    include: { contact: { include: { messages: true } } },
  });

  if (!lead) return NextResponse.json({ error: "리드를 찾을 수 없음" }, { status: 404 });
  if (!lead.contact) return NextResponse.json({ error: "연결된 컨택트 없음" }, { status: 400 });

  // CSV export에서 _id(lea_XXXX)로 lead 데이터 조회
  const lemlistLead = await fetchLeadFromCampaign(lead.campaignId, lead.lemlistLeadId);

  // 1. Contact 복원 (email, linkedinUrl, company, role)
  const nameParts = [lemlistLead.firstName, lemlistLead.lastName].filter(Boolean).join(" ");
  await prisma.contact.update({
    where: { airtableId: lead.contact.airtableId },
    data: {
      ...(nameParts && { name: nameParts }),
      ...(lemlistLead.email !== undefined && { email: lemlistLead.email || null }),
      ...(lemlistLead.linkedinUrl !== undefined && { linkedinUrl: lemlistLead.linkedinUrl || null }),
      ...(lemlistLead.companyName !== undefined && { company: lemlistLead.companyName || null }),
      ...(lemlistLead.jobTitle !== undefined && { role: lemlistLead.jobTitle || null }),
    },
  });

  // 2. Message 복원
  const msg = lead.contact.messages[0];
  if (msg) {
    const msgUpdate: Record<string, string | null> = {};
    for (const [lemKey, dbKeys] of Object.entries(LEMLIST_TO_DB)) {
      const val = lemlistLead[lemKey] ?? null;
      for (const dbKey of dbKeys) {
        msgUpdate[dbKey] = val;
      }
    }
    await prisma.message.update({ where: { id: msg.id }, data: msgUpdate });
  }

  // 3. 상태 복원 — Lemlist lead에 lastState가 있으면 적용
  const restoredState = lemlistLead.lastState ?? null;

  // 4. dirty 플래그 초기화
  await prisma.campaignLead.update({
    where: { id },
    data: {
      ...(restoredState !== null && { state: restoredState }),
      isLemlistDirty: false,
    },
  });

  return NextResponse.json({ ok: true });
}
